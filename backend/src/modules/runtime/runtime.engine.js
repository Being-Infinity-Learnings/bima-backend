// Purpose: Implements the live quiz runtime engine. Manages quiz phases
// (lobby, question, leaderboard, results, completed), scheduling of
// phase transitions via BullMQ (see runtime.queue.js), handling of
// submissions, score calculation, and broadcasting runtime updates and
// results to connected socket clients.
//
// IMPORTANT — horizontal scaling shape: an engine instance is now
// short-lived. It is constructed fresh (via runtime.manager.loadEngine/
// withEngine) from whatever is currently in Redis, used for one
// operation (a socket event, an HTTP call, or a BullMQ job), and then
// discarded — its mutated `this.runtime` core state gets persisted back
// to Redis by the caller. Leaderboard/submissions/connected-user data is
// NOT held on `this.runtime`; every access goes straight through
// runtime.store (Redis) so it's immediately visible to every instance,
// not just the one that made the change.
const prisma = require("../../config/prisma");

const store = require("./runtime.store");

const { QuizPhase, RuntimeConfig } = require("./runtime.constants");

const socketBroadcast = require("../socket/socket.broadcast");

const calculateScore = require("./runtime.scoring");

const { schedulePhaseAction, cancelPhaseAction } = require("./runtime.queue");

// RuntimeEngine: encapsulates an active quiz runtime's core state and
// exposes methods to start and progress the quiz, accept submissions,
// and compute results.
class RuntimeEngine {
  constructor(runtime) {
    this.runtime = runtime;
  }

  get quizId() {
    return this.runtime.quiz.id;
  }

  // Return the duration (ms) for a question, using a custom timer if set.
  getQuestionDuration(question) {
    return (question.customTimer ?? this.runtime.quiz.defaultTimer) * 1000;
  }

  // Broadcast the current runtime state to all clients in the quiz room.
  async broadcastRuntimeState() {
    socketBroadcast.broadcastRuntimeState(
      this.quizId,
      await this.getRuntimeState(),
    );
  }

  // Change the current runtime phase and set phase timing metadata.
  changePhase(phase, durationMs = null) {
    this.runtime.phase = phase;

    this.runtime.phaseStartedAt = new Date();

    if (durationMs) {
      this.runtime.phaseEndsAt = new Date(Date.now() + durationMs);
    } else {
      this.runtime.phaseEndsAt = null;
    }
  }

  // Schedule the next phase-transition action via BullMQ. `action` must
  // be the name of a method on this engine (e.g. "enterQuestion",
  // "finishQuestion", "enterLeaderboard", "enterResults", "complete") —
  // the quiz-phase worker looks the method up by this name when the job
  // fires (see runtime.worker.js).
  async scheduleNext(action, delay) {
    await schedulePhaseAction(this.quizId, action, delay);
  }

  // Start the runtime: mark quiz live in DB and enter lobby.
  //
  // The lobby is meant to end exactly at the quiz's scheduledStartTime.
  // Normally that means running for the full configured
  // LOBBY_DURATION_MS, because quiz-start.queue.js schedules this job to
  // fire at (scheduledStartTime - LOBBY_DURATION_MS). But if an admin
  // schedules/edits a quiz such that there's LESS time between "now" and
  // scheduledStartTime than the configured lobby duration (e.g. quiz is
  // scheduled for 5 minutes from now but lobby duration is 10 minutes),
  // that delay clamps to 0 and this job fires immediately — in which
  // case the lobby must run for whatever time is actually left (5
  // minutes here), not the full configured duration, or the quiz would
  // start 5 minutes late. If scheduledStartTime has already passed
  // entirely by the time this runs (e.g. a delayed worker), the lobby
  // duration collapses to 0 and we move on to the first question right
  // away instead of waiting the full configured duration.
  async start() {
    await prisma.quiz.update({
      where: {
        id: this.quizId,
      },

      data: {
        status: "LIVE",

        actualStartTime: new Date(),
      },
    });

    this.runtime.startedAt = new Date();

    const remainingUntilScheduledStart =
      new Date(this.runtime.quiz.scheduledStartTime).getTime() - Date.now();

    const lobbyDuration = Math.max(
      Math.min(remainingUntilScheduledStart, RuntimeConfig.LOBBY_DURATION_MS),
      0,
    );

    await this.enterLobby(lobbyDuration);
  }

  // Enter the lobby phase and schedule transition to the first question.
  // `durationMs` defaults to the full configured lobby duration but is
  // overridden by start() when less time is actually available before
  // scheduledStartTime — see the comment on start() above.
  async enterLobby(durationMs = RuntimeConfig.LOBBY_DURATION_MS) {
    console.log(`[Runtime] Lobby (${durationMs}ms)`);

    this.changePhase(QuizPhase.LOBBY, durationMs);

    await this.broadcastRuntimeState();

    await this.scheduleNext("enterQuestion", durationMs);
  }

  // Advance to the next question, set timers, broadcast state, and
  // schedule finishQuestion.
  async enterQuestion() {
    this.runtime.currentQuestionIndex++;

    if (this.runtime.currentQuestionIndex >= this.runtime.questions.length) {
      return this.enterResults();
    }

    this.runtime.currentQuestion =
      this.runtime.questions[this.runtime.currentQuestionIndex];

    await store.clearSubmissions(this.quizId);

    const duration = this.getQuestionDuration(this.runtime.currentQuestion);

    this.runtime.currentDurationMs = duration;

    console.log(`[Runtime] Question ${this.runtime.currentQuestionIndex + 1}`);

    this.changePhase(QuizPhase.QUESTION, duration);

    await this.broadcastRuntimeState();

    await this.scheduleNext("finishQuestion", duration);
  }

  /// Called exactly once, the instant a question's timer runs out (whether
  /// it was the last question or not). This is the ONLY place that decides
  /// what happens next, and it always does the same two things in the same
  /// order for every question:
  ///
  ///   1. Immediately tell every client whether they were right/wrong (the
  ///      server stays logically in the QUESTION phase while this plays out
  ///      client-side, so the reveal animation can run without racing a
  ///      phase change).
  ///   2. Exactly REVEAL_DELAY_MS later, atomically flip the phase AND
  ///      broadcast that new phase together, in the same tick — never one
  ///      before the other. Clients navigate purely off `runtimeUpdated`,
  ///      so this is what guarantees the reveal always lasts exactly
  ///      REVEAL_DELAY_MS on every client, no more, no less.
  // Called when a question's timer expires. Builds question results,
  // broadcasts immediate per-user reveal payloads then schedules the
  // transition to leaderboard or results after REVEAL_DELAY_MS.
  async finishQuestion() {
    const isLastQuestion = this.isLastQuestion();

    if (isLastQuestion) {
      // Computes scores for every participant, ranks them, adds the
      // top-10 finishing bonus, updates the leaderboard, and only then
      // persists the final question's submissions to the DB.
      await this.finalizeLastQuestion();
    } else {
      // Participants who never submitted an answer still owe the full
      // question duration to their aggregate-time tie-breaker.
      await this.applyNonSubmittersAggregate();
    }

    const questionResults = await this.buildQuestionResults();

    this.runtime.lastQuestionResults = mapToObject(questionResults);

    socketBroadcast.broadcastQuestionResults(questionResults);

    await this.scheduleNext(
      isLastQuestion ? "enterResults" : "enterLeaderboard",
      RuntimeConfig.REVEAL_DELAY_MS,
    );
  }

  // For every registered participant who did not submit an answer to the
  // current (non-final) question, credit the full question duration to
  // their aggregate-time tie-breaker (no score change).
  async applyNonSubmittersAggregate() {
    const userIds = await store.getLeaderboardUserIds(this.quizId);

    for (const userId of userIds) {
      const submitted = await store.hasSubmission(this.quizId, userId);

      if (!submitted) {
        await this.updateLeaderboard(userId, 0, this.runtime.currentDurationMs);
      }
    }
  }

  // Finalize the last question: apply every buffered submission's score
  // and aggregate time to the leaderboard, rank participants, award the
  // top-10 finishing bonus (10 pts for 1st ... 1 pt for 10th) on top of
  // their final-question score, and only then persist the (possibly
  // bonus-adjusted) submissions to the DB.
  async finalizeLastQuestion() {
    const durationMs = this.runtime.currentDurationMs;

    const userIds = await store.getLeaderboardUserIds(this.quizId);

    for (const userId of userIds) {
      const submission = await store.getSubmission(this.quizId, userId);

      if (submission) {
        await this.updateLeaderboard(
          userId,
          submission.score,
          submission.correct ? submission.elapsedMs : durationMs,
        );
      } else {
        // Never submitted an answer to the final question.
        await this.updateLeaderboard(userId, 0, durationMs);
      }
    }

    const FINISHING_BONUS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

    const ranked = await this.getLeaderboard();

    for (let i = 0; i < Math.min(FINISHING_BONUS.length, ranked.length); i++) {
      const { userId } = ranked[i];
      const bonus = FINISHING_BONUS[i];

      const submission = await store.getSubmission(this.quizId, userId);

      // A user with no submission for the final question never actually
      // answered it — don't give them a finishing bonus, even if their
      // overall score happened to land them in the top 10.
      if (!submission) {
        continue;
      }

      await this.updateLeaderboard(userId, bonus, 0);

      submission.score += bonus;
      await store.setSubmission(this.quizId, userId, submission);
    }

    const allSubmissions = await store.getAllSubmissions(this.quizId);

    for (const [, submission] of allSubmissions) {
      await this.persistSubmission(submission);
    }
  }

  // Enter leaderboard phase, broadcast leaderboard, and schedule next
  // question.
  async enterLeaderboard() {
    console.log("[Runtime] Leaderboard");

    // changePhase() (which stamps phaseStartedAt/phaseEndsAt) and the
    // broadcast that tells clients about it happen back-to-back, with
    // nothing async in between — so the timestamps we hand out are exactly
    // the timestamps clients start counting down from.
    this.changePhase(
      QuizPhase.LEADERBOARD,
      RuntimeConfig.LEADERBOARD_DURATION_MS,
    );

    socketBroadcast.broadcastLeaderboard(
      this.quizId,
      await this.buildLeaderboardPayload(),
    );

    await this.broadcastRuntimeState();

    await this.scheduleNext(
      "enterQuestion",
      RuntimeConfig.LEADERBOARD_DURATION_MS,
    );
  }

  // Enter results phase, compute final results and broadcast them.
  async enterResults() {
    console.log("[Runtime] Results");

    this.changePhase(QuizPhase.RESULTS, RuntimeConfig.RESULTS_DURATION_MS);

    const finalResults = await this.buildFinalResults();
    this.runtime.finalResults = mapToObject(finalResults);

    socketBroadcast.broadcastLeaderboard(
      this.quizId,
      await this.buildLeaderboardPayload(),
    );

    socketBroadcast.broadcastFinalResults(finalResults);

    await this.broadcastRuntimeState();

    await this.scheduleNext("complete", RuntimeConfig.RESULTS_DURATION_MS);
  }

  // Ensure provided selected option ids exist on the question.
  validateSelectedOptions(question, selectedOptionIds) {
    const validOptionIds = new Set(question.options.map((option) => option.id));

    const allValid = selectedOptionIds.every((id) => validOptionIds.has(id));

    if (!allValid) {
      throw new Error("Invalid option selected.");
    }
  }

  // Process an incoming answer submission: validate, compute score,
  // persist to DB, update leaderboard, and store the submission.
  //
  // Wrapped in a distributed lock (per quiz) by the caller (see
  // socket/quiz.socket.js) so two submissions racing on different app
  // instances for the same quiz can't corrupt the "everyone answered"
  // early-finish check.
  async submitAnswer({ userId, questionId, selectedOptionIds }) {
    await this.validateSubmission({ userId, questionId });

    const question = this.runtime.currentQuestion;

    this.validateSelectedOptions(question, selectedOptionIds);

    const correct = this.isCorrectAnswer(question, selectedOptionIds);

    const submittedAt = new Date();

    const elapsedMs =
      submittedAt.getTime() - this.runtime.phaseStartedAt.getTime();

    const score = correct
      ? calculateScore({
          elapsedMs,
          durationMs: this.runtime.currentDurationMs,
          maxScore: RuntimeConfig.MAX_SCORE_PER_QUESTION,
        })
      : 0;

    const submission = this.buildSubmission({
      userId,

      questionId,

      selectedOptionIds,

      submittedAt,

      elapsedMs,

      correct,

      score,
    });

    if (this.isLastQuestion()) {
      // The last question needs the top-10 finishing bonus applied before
      // anything is written to the DB or reflected on the leaderboard, and
      // that bonus can only be computed once every submission for this
      // question is known. So for the last question we just buffer the
      // submission here; finalizeLastQuestion() (called from
      // finishQuestion()) is what computes scores, ranks everyone, adds
      // the bonus, updates the leaderboard, and persists everything.
      await store.setSubmission(this.quizId, userId, submission);
    } else {
      await this.persistSubmission(submission);

      await this.updateLeaderboard(
        userId,
        score,
        correct ? elapsedMs : this.runtime.currentDurationMs,
      );

      await store.setSubmission(this.quizId, userId, submission);
    }

    // If every registered participant has now answered this question,
    // don't make the rest of the room wait out the clock: skip straight
    // to finishing the question (reveal -> leaderboard/results) instead
    // of waiting for the timer to expire naturally.
    await this.maybeFinishQuestionEarly();

    return;
  }

  // Whether the current question is the final question of the quiz.
  isLastQuestion() {
    return (
      this.runtime.currentQuestionIndex === this.runtime.questions.length - 1
    );
  }

  // Check whether all registered participants have submitted an answer
  // for the current question and, if so, jump straight to finishQuestion()
  // instead of waiting for the remaining time to elapse. Reuses
  // scheduleNext() so it replaces the pending timer-expiry job with an
  // immediate one, keeping finishQuestion() as the single source of truth
  // for what happens next.
  async maybeFinishQuestionEarly() {
    if (this.runtime.phase !== QuizPhase.QUESTION) {
      return;
    }

    const totalParticipants = await store.leaderboardSize(this.quizId);

    if (totalParticipants === 0) {
      return;
    }

    const submittedCount = await store.submissionsCount(this.quizId);

    const everyoneAnswered = submittedCount >= totalParticipants;

    if (!everyoneAnswered) {
      return;
    }

    console.log(
      `[Runtime] All ${totalParticipants} participants answered - advancing early`,
    );

    await this.scheduleNext("finishQuestion", 0);
  }

  // Validate that submissions are currently accepted and not duplicated.
  async validateSubmission({ userId, questionId }) {
    if (this.runtime.phase !== QuizPhase.QUESTION) {
      throw new Error("Quiz is not accepting answers.");
    }

    if (questionId !== this.runtime.currentQuestion.id) {
      throw new Error("Invalid question.");
    }

    if (await store.hasSubmission(this.quizId, userId)) {
      throw new Error("Answer already submitted.");
    }
  }

  // Determine whether the submitted answer is correct for the question.
  isCorrectAnswer(question, selectedOptionIds) {
    switch (question.questionType) {
      case "SINGLE_CORRECT": {
        if (selectedOptionIds.length !== 1) {
          return false;
        }

        const correctOption = question.options.find(
          (option) => option.isCorrect,
        );

        return correctOption.id === selectedOptionIds[0];
      }

      default:
        throw new Error(`Unsupported question type: ${question.questionType}`);
    }
  }

  // Add a score delta and an aggregate-time delta to a user's leaderboard
  // entry (backed by a Redis sorted set + hash — see runtime.store.js).
  // Returns the entry's new total score.
  async updateLeaderboard(userId, score, aggregateTimeDeltaMs = 0) {
    return store.updateLeaderboard(
      this.quizId,
      userId,
      score,
      aggregateTimeDeltaMs,
    );
  }

  // Register a user in the runtime leaderboard if not present.
  async registerParticipant(user) {
    await store.registerParticipant(this.quizId, user.id, {
      fullName: user.fullName,
      profileImage: user.profileImage,
    });
  }

  // Build a normalized submission object for storage and in-memory use.
  buildSubmission({
    userId,
    questionId,
    selectedOptionIds,
    submittedAt,
    elapsedMs,
    correct,
    score,
  }) {
    return {
      userId,

      questionId,

      selectedOptionIds,

      submittedAt,

      elapsedMs,

      correct,

      score,
    };
  }

  // Persist a submission record to the database.
  async persistSubmission(submission) {
    await prisma.quizSubmission.create({
      data: {
        quizId: this.quizId,

        userId: submission.userId,

        questionId: submission.questionId,

        selectedOptionIds: submission.selectedOptionIds,

        correct: submission.correct,

        score: submission.score,

        elapsedMs: submission.elapsedMs,

        submittedAt: new Date(submission.submittedAt),
      },
    });
  }

  // Returns remaining time (ms) in the current phase, or null if none.
  getRemainingTime() {
    if (!this.runtime.phaseEndsAt) {
      return null;
    }

    return Math.max(this.runtime.phaseEndsAt.getTime() - Date.now(), 0);
  }

  // Return the current question object.
  getCurrentQuestion() {
    return this.runtime.currentQuestion;
  }

  // Build the payload sent to clients describing the current question.
  buildQuestionPayload() {
    if (!this.runtime.currentQuestion) {
      return null;
    }

    return {
      id: this.runtime.currentQuestion.id,

      questionText: this.runtime.currentQuestion.questionText,

      // Prisma stores the question media as `mediaUrl`; the Flutter client
      // expects `questionImage`, so expose both for compatibility.
      questionImage: this.runtime.currentQuestion.mediaUrl ?? null,
      mediaUrl: this.runtime.currentQuestion.mediaUrl ?? null,

      questionType: this.runtime.currentQuestion.questionType,
      durationMs:
        this.runtime.currentDurationMs ??
        this.getQuestionDuration(this.runtime.currentQuestion),

      options: this.runtime.currentQuestion.options.map((option) => ({
        id: option.id,

        optionText: option.optionText,

        // The current schema does not yet have option-level media, but we
        // still pass through any future `optionImage`/`mediaUrl` field so the
        // frontend can render it without another runtime change.
        optionImage: option.optionImage ?? option.mediaUrl ?? null,
      })),
    };
  }

  // Build a leaderboard payload limited to the top N entries.
  async buildLeaderboardPayload(limit = 10) {
    const leaderboard = await this.getLeaderboard();
    return {
      leaderboard: leaderboard.slice(0, limit),
    };
  }

  async buildResultsPayload() {
    return {
      leaderboard: await this.getLeaderboard(),
    };
  }

  // Construct final results map for broadcast/storage.
  async buildFinalResults() {
    const results = new Map();

    const leaderboard = await this.getLeaderboard();

    for (const entry of leaderboard) {
      results.set(entry.userId, {
        rank: entry.rank,

        totalScore: entry.totalScore,
      });
    }

    return results;
  }

  // Build per-user question results (correct flag, score, rank, etc.).
  async buildQuestionResults() {
    const correctOptionIds = this.runtime.currentQuestion.options
      .filter((option) => option.isCorrect)
      .map((option) => option.id);

    const results = new Map();
    const leaderboard = await this.getLeaderboard();

    for (const entry of leaderboard) {
      const submission = await store.getSubmission(this.quizId, entry.userId);

      results.set(entry.userId, {
        // Everyone needs a result payload so the client can animate and
        // advance even if they timed out or never submitted an answer.
        correct: submission?.correct ?? false,

        score: submission?.score ?? 0,

        totalScore: entry.totalScore,

        rank: entry.rank,

        correctOptionIds,
      });
    }

    return results;
  }

  // Return a sorted array representation of the Redis-backed leaderboard.
  // Sort order (all ascending in "better" direction):
  //   1. totalScore, descending (higher score wins)
  //   2. aggregateTimeMs, ascending (less time spent on correct answers wins)
  //   3. joinedAt, ascending (earlier join wins)
  async getLeaderboard() {
    return store.getLeaderboard(this.quizId);
  }

  // Convenience: top N entries from leaderboard.
  async getTopLeaderboard(limit = 10) {
    const leaderboard = await this.getLeaderboard();
    return leaderboard.slice(0, limit);
  }

  // Return a user's current rank or null if not present.
  async getUserRank(userId) {
    const leaderboard = await this.getLeaderboard();

    const index = leaderboard.findIndex((entry) => entry.userId === userId);

    if (index === -1) {
      return null;
    }

    return index + 1;
  }

  // Return a user's current total score.
  async getUserScore(userId) {
    const entry = await store.getLeaderboardEntry(this.quizId, userId);
    return entry?.score ?? 0;
  }

  // Build the canonical runtime state object sent to clients.
  async getRuntimeState() {
    const baseState = {
      quizId: this.quizId,

      phase: this.runtime.phase,

      remainingTime: this.getRemainingTime(),
      phaseStartedAt: this.runtime.phaseStartedAt?.toISOString() ?? null,
      phaseEndsAt: this.runtime.phaseEndsAt?.toISOString() ?? null,
      serverTime: Date.now(),
    };

    switch (this.runtime.phase) {
      case QuizPhase.WAITING:
        return {
          ...baseState,
        };

      case QuizPhase.LOBBY:
        return {
          ...baseState,

          connectedUsers: await store.connectedCount(this.quizId),
        };

      case QuizPhase.QUESTION:
        return {
          ...baseState,

          questionIndex: this.runtime.currentQuestionIndex,
          totalQuestions: this.runtime.questions.length,

          question: this.buildQuestionPayload(),
        };

      case QuizPhase.LEADERBOARD:
        return baseState;

      case QuizPhase.RESULTS:
        return baseState;

      case QuizPhase.COMPLETED:
        return {
          ...baseState,
        };

      default:
        return baseState;
    }
  }

  // Return whether the runtime is currently active/running.
  isRunning() {
    return (
      this.runtime.phase !== QuizPhase.COMPLETED &&
      this.runtime.phase !== QuizPhase.WAITING
    );
  }

  // Check whether a user is registered as a participant in this runtime.
  async isParticipantRegistered(userId) {
    return store.hasLeaderboardEntry(this.quizId, userId);
  }

  // Add/remove a user from the connected-users presence set (Redis SET).
  async addConnectedUser(userId) {
    await store.addConnected(this.quizId, userId);
  }

  async removeConnectedUser(userId) {
    await store.removeConnected(this.quizId, userId);
  }

  // Mark the quiz completed in the DB, broadcast final state, cancel any
  // dangling phase job, and destroy all Redis keys for this runtime.
  async complete() {
    await prisma.quiz.update({
      where: {
        id: this.quizId,
      },

      data: {
        status: "COMPLETED",

        completedAt: new Date(),
      },
    });

    this.changePhase(QuizPhase.COMPLETED);

    await this.broadcastRuntimeState();

    await cancelPhaseAction(this.quizId);
    await store.deleteAll(this.quizId);

    // Tell runtime.manager.withEngine() not to resurrect the state key we
    // just deleted by re-saving it afterwards.
    this._destroyed = true;

    console.log("[Runtime] Completed");
  }
}

// Convert a Map<userId, payload> into a plain {userId: payload} object so
// it can be JSON-serialized into the core state blob stored in Redis.
function mapToObject(map) {
  return Object.fromEntries(map.entries());
}

module.exports = RuntimeEngine;
