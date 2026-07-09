// Purpose: Implements the live quiz runtime engine. Manages quiz phases
// (lobby, question, leaderboard, results, completed), scheduling of
// phase transitions, handling of submissions, score calculation, and
// broadcasting runtime updates and results to connected socket clients.
const prisma = require("../../config/prisma");

const manager = require("./runtime.manager");

const { QuizPhase, RuntimeConfig } = require("./runtime.constants");

const { socketBroadcast } = require("../socket");

const calculateScore = require("./runtime.scoring");

// RuntimeEngine: encapsulates an active quiz runtime and exposes methods
// to start and progress the quiz, accept submissions, and compute results.
class RuntimeEngine {
  constructor(runtime) {
    this.runtime = runtime;
  }

  // Return the duration (ms) for a question, using a custom timer if set.
  getQuestionDuration(question) {
    return (question.customTimer ?? this.runtime.quiz.defaultTimer) * 1000;
  }

  // Broadcast the current runtime state to all clients in the quiz room.
  broadcastRuntimeState() {
    socketBroadcast.broadcastRuntimeState(
      this.runtime.quiz.id,
      this.getRuntimeState(),
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

  // Schedule the next phase/action; clears any existing timeout first.
  scheduleNext(callback, delay) {
    if (this.runtime.timeoutHandle) {
      clearTimeout(this.runtime.timeoutHandle);
    }

    this.runtime.timeoutHandle = setTimeout(callback, delay);
  }

  // Start the runtime: mark quiz live in DB and enter lobby.
  async start() {
    await prisma.quiz.update({
      where: {
        id: this.runtime.quiz.id,
      },

      data: {
        status: "LIVE",

        actualStartTime: new Date(),
      },
    });

    this.runtime.startedAt = new Date();

    this.enterLobby();
  }

  // Enter the lobby phase and schedule transition to the first question.
  enterLobby() {
    console.log(`[Runtime] Lobby`);

    this.changePhase(QuizPhase.LOBBY, RuntimeConfig.LOBBY_DURATION_MS);

    this.broadcastRuntimeState();

    this.scheduleNext(
      () => this.enterQuestion(),
      RuntimeConfig.LOBBY_DURATION_MS,
    );
  }

  // Advance to the next question, set timers, broadcast state, and
  // schedule finishQuestion.
  enterQuestion() {
    this.runtime.currentQuestionIndex++;

    if (this.runtime.currentQuestionIndex >= this.runtime.questions.length) {
      return this.enterResults();
    }

    this.runtime.currentQuestion =
      this.runtime.questions[this.runtime.currentQuestionIndex];

    this.runtime.submissions.clear();

    const duration = this.getQuestionDuration(this.runtime.currentQuestion);

    this.runtime.currentDurationMs = duration;

    console.log(`[Runtime] Question ${this.runtime.currentQuestionIndex + 1}`);

    this.changePhase(QuizPhase.QUESTION, duration);

    this.broadcastRuntimeState();

    this.scheduleNext(() => this.finishQuestion(), duration);
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
  finishQuestion() {
    const questionResults = this.buildQuestionResults();

    this.runtime.lastQuestionResults = questionResults;

    const isLastQuestion =
      this.runtime.currentQuestionIndex === this.runtime.questions.length - 1;

    socketBroadcast.broadcastQuestionResults(questionResults);

    this.scheduleNext(() => {
      if (isLastQuestion) {
        this.enterResults();
      } else {
        this.enterLeaderboard();
      }
    }, RuntimeConfig.REVEAL_DELAY_MS);
  }

  // Enter leaderboard phase, broadcast leaderboard, and schedule next
  // question.
  enterLeaderboard() {
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
      this.runtime.quiz.id,
      this.buildLeaderboardPayload(),
    );

    this.broadcastRuntimeState();

    this.scheduleNext(
      () => this.enterQuestion(),
      RuntimeConfig.LEADERBOARD_DURATION_MS,
    );
  }

  // Enter results phase, compute final results and broadcast them.
  enterResults() {
    console.log("[Runtime] Results");

    this.changePhase(QuizPhase.RESULTS, RuntimeConfig.RESULTS_DURATION_MS);

    this.runtime.finalResults = this.buildFinalResults();

    socketBroadcast.broadcastLeaderboard(
      this.runtime.quiz.id,
      this.buildLeaderboardPayload(),
    );

    socketBroadcast.broadcastFinalResults(this.runtime.finalResults);

    this.broadcastRuntimeState();

    this.scheduleNext(() => this.complete(), RuntimeConfig.RESULTS_DURATION_MS);
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
  async submitAnswer({ userId, questionId, selectedOptionIds }) {
    this.validateSubmission({
      userId,
      questionId,
    });

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

    await this.persistSubmission(submission);

    const totalScore = this.updateLeaderboard(userId, score);

    this.runtime.submissions.set(userId, submission);

    return;
  }

  // Validate that submissions are currently accepted and not duplicated.
  validateSubmission({ userId, questionId }) {
    if (this.runtime.phase !== QuizPhase.QUESTION) {
      throw new Error("Quiz is not accepting answers.");
    }

    if (questionId !== this.runtime.currentQuestion.id) {
      throw new Error("Invalid question.");
    }

    if (this.runtime.submissions.has(userId)) {
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

  // Update in-memory leaderboard with a user's incremental score.
  updateLeaderboard(userId, score) {
    let entry = this.runtime.leaderboard.get(userId);

    if (!entry) {
      entry = {
        score: 0,

        fullName: "",

        profileImage: null,
      };
    }

    entry.score += score;

    this.runtime.leaderboard.set(userId, entry);

    return entry.score;
  }

  // Register a user in the runtime leaderboard if not present.
  registerParticipant(user) {
    if (this.runtime.leaderboard.has(user.id)) {
      return;
    }

    this.runtime.leaderboard.set(user.id, {
      score: 0,

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
        quizId: this.runtime.quiz.id,

        userId: submission.userId,

        questionId: submission.questionId,

        selectedOptionIds: submission.selectedOptionIds,

        correct: submission.correct,

        score: submission.score,

        elapsedMs: submission.elapsedMs,

        submittedAt: submission.submittedAt,
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
  buildLeaderboardPayload(limit = 10) {
    return {
      leaderboard: this.getLeaderboard().slice(0, limit),
    };
  }

  buildResultsPayload() {
    return {
      leaderboard: this.getLeaderboard(),
    };
  }

  // Construct final results map for broadcast/storage.
  buildFinalResults() {
    const results = new Map();

    const leaderboard = this.getLeaderboard();

    for (const entry of leaderboard) {
      results.set(entry.userId, {
        rank: entry.rank,

        totalScore: entry.totalScore,
      });
    }

    return results;
  }

  // Build per-user question results (correct flag, score, rank, etc.).
  buildQuestionResults() {
    const correctOptionIds = this.runtime.currentQuestion.options
      .filter((option) => option.isCorrect)
      .map((option) => option.id);

    const results = new Map();
    const leaderboard = this.getLeaderboard();

    for (const entry of leaderboard) {
      const submission = this.runtime.submissions.get(entry.userId);

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

  // Return a sorted array representation of the in-memory leaderboard.
  getLeaderboard() {
    return [...this.runtime.leaderboard.entries()]
      .map(([userId, entry]) => ({
        userId,

        fullName: entry.fullName,

        profileImage: entry.profileImage,

        totalScore: entry.score,
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((entry, index) => ({
        rank: index + 1,

        ...entry,
      }));
  }

  // Convenience: top N entries from leaderboard.
  getTopLeaderboard(limit = 10) {
    return this.getLeaderboard().slice(0, limit);
  }

  // Return a user's current rank or null if not present.
  getUserRank(userId) {
    const leaderboard = this.getLeaderboard();

    const index = leaderboard.findIndex((entry) => entry.userId === userId);

    if (index === -1) {
      return null;
    }

    return index + 1;
  }

  // Return a user's current total score.
  getUserScore(userId) {
    return this.runtime.leaderboard.get(userId)?.score ?? 0;
  }

  // Build the canonical runtime state object sent to clients.
  getRuntimeState() {
    const baseState = {
      quizId: this.runtime.quiz.id,

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

          connectedUsers: this.runtime.connectedUsers.size,
        };

      case QuizPhase.QUESTION:
        return {
          ...baseState,

          questionIndex: this.runtime.currentQuestionIndex,

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
  isParticipantRegistered(userId) {
    return this.runtime.leaderboard.has(userId);
  }

  // Mark the quiz completed in the DB, broadcast final state, and
  // destroy the runtime manager entry.
  async complete() {
    await prisma.quiz.update({
      where: {
        id: this.runtime.quiz.id,
      },

      data: {
        status: "COMPLETED",

        completedAt: new Date(),
      },
    });

    this.changePhase(QuizPhase.COMPLETED);

    this.broadcastRuntimeState();

    manager.destroy(this.runtime.quiz.id);

    console.log("[Runtime] Completed");
  }
}

module.exports = RuntimeEngine;
