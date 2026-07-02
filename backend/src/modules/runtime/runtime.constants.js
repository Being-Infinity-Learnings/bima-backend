const QuizPhase = Object.freeze({
  WAITING: "WAITING",

  LOBBY: "LOBBY",

  QUESTION: "QUESTION",

  LEADERBOARD: "LEADERBOARD",

  RESULTS: "RESULTS",

  COMPLETED: "COMPLETED",
});

const RuntimeConfig = Object.freeze({
  // Temporary values for testing

  LOBBY_DURATION_MS: 30000,

  LEADERBOARD_DURATION_MS: 10000,

  RESULTS_DURATION_MS: 5000,

  MAX_SCORE_PER_QUESTION: 1000,
});

module.exports = {
  QuizPhase,
  RuntimeConfig,
};
