const prisma = require("../../config/prisma");

const manager = require("./runtime.manager");

const { QuizPhase, RuntimeConfig } = require("./runtime.constants");

const { socketBroadcast } = require("../socket");

const calculateScore = require("./runtime.scoring");

class RuntimeEngine {
  constructor(runtime) {
    this.runtime = runtime;
  }

  getQuestionDuration(question) {
    return (question.customTimer ?? this.runtime.quiz.defaultTimer) * 1000;
  }

  broadcastRuntimeState() {
    socketBroadcast.broadcastRuntimeState(
      this.runtime.quiz.id,
      this.getRuntimeState(),
    );
  }

  changePhase(phase, durationMs = null) {
    this.runtime.phase = phase;

    this.runtime.phaseStartedAt = new Date();

    if (durationMs) {
      this.runtime.phaseEndsAt = new Date(Date.now() + durationMs);
    } else {
      this.runtime.phaseEndsAt = null;
    }
  }

  scheduleNext(callback, delay) {
    if (this.runtime.timeoutHandle) {
      clearTimeout(this.runtime.timeoutHandle);
    }

    this.runtime.timeoutHandle = setTimeout(callback, delay);
  }

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

  enterLobby() {
    console.log(`[Runtime] Lobby`);

    this.changePhase(QuizPhase.LOBBY, RuntimeConfig.LOBBY_DURATION_MS);

    this.broadcastRuntimeState();

    this.scheduleNext(
      () => this.enterQuestion(),
      RuntimeConfig.LOBBY_DURATION_MS,
    );
  }

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

  finishQuestion() {
    const isLastQuestion =
      this.runtime.currentQuestionIndex === this.runtime.questions.length - 1;

    if (isLastQuestion) {
      this.enterResults();
      return;
    }

    this.enterLeaderboard();
    this.runtime.lastQuestionResults = this.buildQuestionResults();
  }

  enterLeaderboard() {
    console.log("[Runtime] Leaderboard");

    this.changePhase(
      QuizPhase.LEADERBOARD,
      RuntimeConfig.LEADERBOARD_DURATION_MS,
    );

    socketBroadcast.broadcastLeaderboard(
      this.runtime.quiz.id,
      this.buildLeaderboardPayload(),
    );

    socketBroadcast.broadcastQuestionResults(this.buildQuestionResults());

    this.broadcastRuntimeState();

    this.scheduleNext(
      () => this.enterQuestion(),
      RuntimeConfig.LEADERBOARD_DURATION_MS,
    );
  }
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

  validateSelectedOptions(question, selectedOptionIds) {
    const validOptionIds = new Set(question.options.map((option) => option.id));

    const allValid = selectedOptionIds.every((id) => validOptionIds.has(id));

    if (!allValid) {
      throw new Error("Invalid option selected.");
    }
  }

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

  getRemainingTime() {
    if (!this.runtime.phaseEndsAt) {
      return null;
    }

    return Math.max(this.runtime.phaseEndsAt.getTime() - Date.now(), 0);
  }

  getCurrentQuestion() {
    return this.runtime.currentQuestion;
  }

  buildQuestionPayload() {
    if (!this.runtime.currentQuestion) {
      return null;
    }

    return {
      id: this.runtime.currentQuestion.id,

      questionText: this.runtime.currentQuestion.questionText,

      questionImage: this.runtime.currentQuestion.questionImage,

      questionType: this.runtime.currentQuestion.questionType,

      options: this.runtime.currentQuestion.options.map((option) => ({
        id: option.id,

        optionText: option.optionText,

        optionImage: option.optionImage,
      })),
    };
  }

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

  buildQuestionResults() {
    const correctOptionIds = this.runtime.currentQuestion.options
      .filter((option) => option.isCorrect)
      .map((option) => option.id);

    const results = new Map();

    for (const [userId, submission] of this.runtime.submissions) {
      results.set(userId, {
        correct: submission.correct,

        score: submission.score,

        totalScore: this.getUserScore(userId),

        rank: this.getUserRank(userId),

        correctOptionIds,
      });
    }

    return results;
  }

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

  getTopLeaderboard(limit = 10) {
    return this.getLeaderboard().slice(0, limit);
  }

  getUserRank(userId) {
    const leaderboard = this.getLeaderboard();

    const index = leaderboard.findIndex((entry) => entry.userId === userId);

    if (index === -1) {
      return null;
    }

    return index + 1;
  }

  getUserScore(userId) {
    return this.runtime.leaderboard.get(userId)?.score ?? 0;
  }

  getRuntimeState() {
    const baseState = {
      quizId: this.runtime.quiz.id,

      phase: this.runtime.phase,

      remainingTime: this.getRemainingTime(),
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

  isRunning() {
    return (
      this.runtime.phase !== QuizPhase.COMPLETED &&
      this.runtime.phase !== QuizPhase.WAITING
    );
  }

  isParticipantRegistered(userId) {
    return this.runtime.leaderboard.has(userId);
  }

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
