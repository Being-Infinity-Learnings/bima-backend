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

    // Most engine methods (enterLobby, enterQuestion, finishQuestion, ...)
    // mutate this.runtime's own fields (phase, currentQuestionIndex, ...)
    // and rely on withEngine() persisting the full state blob back to Redis
    // afterwards, so this defaults to true. submitAnswer() is the one
    // high-frequency call that never touches this.runtime itself — every
    // write it makes goes through the separate leaderboard/submissions
    // Redis structures instead — so it opts out via this flag and lets
    // withEngine() skip a redundant full-state resave on every submission.
    this._dirty = true;
  }

  get quizId() {
    return this.runtime.quiz.id;
  }

  // Return the duration (ms) for a question, using a custom timer if set.
  getQuestionDuration(question) {
    return (question.customTimer ?? this.runtime.quiz.defaultTimer) * 1000;
  }

  // Broadcast the current runtime state to all clients in the quiz room.
  // Accepts an already-built state (e.g. from a caller that just got a
  // fresh connectedCount from joinParticipant() and built its own snapshot
  // with it) to avoid a redundant getRuntimeState() call for the same
  // moment in time — every other caller omits this and gets one computed
  // fresh, exactly as before.
  async broadcastRuntimeState(precomputedState) {
    socketBroadcast.broadcastRuntimeState(
      this.quizId,
      precomputedState ?? (await this.getRuntimeState()),
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
    // MUST be the first thing this method does. This is what lets
    // submitAnswer() run without the per-quiz lock: it atomically closes
    // the window for new submissions before anything below reads who
    // did/didn't submit, so a submission that's still in flight either
    // lands before this (and gets counted normally) or is rejected by
    // SUBMIT_SCRIPT's closed-flag check (and never reaches here at all) —
    // never both. See loadtest/quiz/LOCK-REMOVAL.md.
    await store.closeSubmissions(this.quizId);

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

      // submitAnswer() no longer writes to Postgres synchronously (see the
      // comment there) — every submission for this question is persisted
      // here, once, in a single batch, now that the question is over.
      await this.persistAllSubmissions();
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

    await this.persistAllSubmissions();
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

  // Process an incoming answer submission: validate, compute score, then
  // atomically update the leaderboard + buffer the submission + detect
  // whether this was the last participant to answer, all in one Redis
  // round trip (store.recordSubmission — see SUBMIT_SCRIPT in
  // runtime.store.js). Persisting to Postgres happens separately, batched,
  // once the question ends (see persistAllSubmissions()).
  //
  // No per-quiz lock here at all anymore (neither caller — the socket
  // handler nor the debug HTTP endpoint — wraps this in one). The one
  // race a lock used to be needed for was this landing at the exact
  // instant a question's timer expires, racing finishQuestion()'s
  // non-submitter sweep; that's now handled by finishQuestion() atomically
  // closing the submission window first (store.closeSubmissions), which
  // SUBMIT_SCRIPT checks before anything else. See
  // loadtest/quiz/LOCK-REMOVAL.md for the full reasoning and
  // loadtest/quiz/ATOMIC-SUBMIT-CHANGE.md for the earlier, still-locked
  // step this built on.
  async submitAnswer({ userId, questionId, selectedOptionIds }) {
    // This method never mutates this.runtime itself — see the constructor
    // comment on _dirty — so withEngine() can skip resaving the full state
    // blob for every single answer.
    this._dirty = false;

    this.validateSubmissionContext(questionId);

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

    const isLast = this.isLastQuestion();

    // The last question needs the top-10 finishing bonus applied before
    // anything is reflected on the leaderboard, and that bonus can only be
    // computed once every submission for this question is known — so for
    // the last question this only buffers the submission (mode: "buffer").
    // finalizeLastQuestion() (called from finishQuestion()) is what
    // computes scores, ranks everyone, adds the bonus, updates the
    // leaderboard, and persists everything. Postgres is NOT written here
    // either way — finishQuestion() batches every submission for this
    // question into ONE Postgres write once it ends (see
    // persistAllSubmissions()), instead of N sequential ones.
    const { tooLate, duplicate, everyoneAnswered } = await store.recordSubmission(
      this.quizId,
      userId,
      {
        mode: isLast ? "buffer" : "score",
        scoreDelta: isLast ? 0 : score,
        aggregateTimeDeltaMs: isLast
          ? 0
          : correct
            ? elapsedMs
            : this.runtime.currentDurationMs,
        submissionJson: JSON.stringify(submission),
      },
    );

    // finishQuestion() had already closed this question's submissions
    // (see the comment there) by the time this one reached Redis — the
    // deadline was hit right as this was in flight. Same user-facing
    // outcome as the phase check above, just a narrower race window that
    // check alone can't catch (phase doesn't flip to LEADERBOARD/RESULTS
    // until REVEAL_DELAY_MS after closing).
    if (tooLate) {
      throw new Error("Quiz is not accepting answers.");
    }

    if (duplicate) {
      throw new Error("Answer already submitted.");
    }

    // If every registered participant has now answered this question,
    // don't make the rest of the room wait out the clock: skip straight to
    // finishing the question (reveal -> leaderboard/results) instead of
    // waiting for the timer to expire naturally. recordSubmission() already
    // determined this atomically in the same round trip as the write, so
    // there's no separate "is everyone done" check left to race.
    if (everyoneAnswered && this.runtime.phase === QuizPhase.QUESTION) {
      console.log(
        `[Runtime] Quiz ${this.quizId}: all participants answered - advancing early`,
      );
      await this.scheduleNext("finishQuestion", 0);
    }

    return;
  }

  // Whether the current question is the final question of the quiz.
  isLastQuestion() {
    return (
      this.runtime.currentQuestionIndex === this.runtime.questions.length - 1
    );
  }

  // Validate that submissions are currently accepted for this question.
  // The "already submitted" check used to live here too (a separate Redis
  // HEXISTS call, made redundant by store.recordSubmission's atomic
  // duplicate check, which is now the sole authority on that) — see
  // loadtest/quiz/ATOMIC-SUBMIT-CHANGE.md.
  validateSubmissionContext(questionId) {
    if (this.runtime.phase !== QuizPhase.QUESTION) {
      throw new Error("Quiz is not accepting answers.");
    }

    if (questionId !== this.runtime.currentQuestion.id) {
      throw new Error("Invalid question.");
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

  // Atomically mark a user connected and register them as a participant
  // if this is their first join — see store.joinParticipant/JOIN_SCRIPT.
  // Returns the fresh connected count.
  async joinParticipant(user) {
    return store.joinParticipant(this.quizId, user.id, {
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

  // Persist every buffered submission for the CURRENT question in one
  // batch, instead of one INSERT per submitter. Called once, from
  // finishQuestion()/finalizeLastQuestion(), after the question has ended —
  // never from submitAnswer() itself, which only buffers to Redis (see the
  // comment there). skipDuplicates guards the same [quizId,userId,
  // questionId] unique constraint a per-row insert would have hit anyway
  // (e.g. a retried job re-processing this question).
  async persistAllSubmissions() {
    const allSubmissions = await store.getAllSubmissions(this.quizId);

    if (allSubmissions.length === 0) {
      return;
    }

    await prisma.quizSubmission.createMany({
      data: allSubmissions.map(([, submission]) => ({
        quizId: this.quizId,
        userId: submission.userId,
        questionId: submission.questionId,
        selectedOptionIds: submission.selectedOptionIds,
        correct: submission.correct,
        score: submission.score,
        elapsedMs: submission.elapsedMs,
        submittedAt: new Date(submission.submittedAt),
      })),
      skipDuplicates: true,
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
    const totalParticipants = await store.leaderboardSize(this.quizId);
    return {
      leaderboard: leaderboard.slice(0, limit),
      totalParticipants,
    };
  }

  async buildResultsPayload() {
    const totalParticipants = await store.leaderboardSize(this.quizId);
    return {
      leaderboard: await this.getLeaderboard(),
      totalParticipants,
    };
  }

  // Construct final results map for broadcast/storage.
  async buildFinalResults() {
    const results = new Map();

    const leaderboard = await this.getLeaderboard();
    const totalParticipants = await store.leaderboardSize(this.quizId);

    for (const entry of leaderboard) {
      results.set(entry.userId, {
        rank: entry.rank,

        totalScore: entry.totalScore,

        totalParticipants,
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
    const totalParticipants = await store.leaderboardSize(this.quizId);

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

        totalParticipants,
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
  //
  // `connectedCountOverride` lets a caller that JUST got a fresh connected
  // count back from a write (joinParticipant()'s return value) pass it
  // straight through, instead of this method re-querying store.connectedCount()
  // a second time for the same number a moment later.
  async getRuntimeState(connectedCountOverride) {
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

          connectedUsers:
            connectedCountOverride ?? (await store.connectedCount(this.quizId)),
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

  // Remove a user from the connected-users presence set (Redis SET). The
  // add side is now handled atomically by joinParticipant() above.
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
