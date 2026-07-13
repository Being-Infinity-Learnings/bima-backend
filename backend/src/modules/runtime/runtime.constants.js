// Purpose: Constants describing runtime phases and configuration values
// used by the runtime engine.
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

  LOBBY_DURATION_MS: 600000,

  LEADERBOARD_DURATION_MS: 12000,

  RESULTS_DURATION_MS: 5000,

  // How long every client holds on the QUESTION screen after time is up so
  // the correct/incorrect reveal animation can play before the phase
  // actually advances. This is the ONLY place that delay is defined — the
  // phase change (and the runtimeUpdated broadcast that tells clients to
  // navigate on) always happens exactly REVEAL_DELAY_MS after the question
  // ends, never before, so the server's clock and client navigation are
  // always in lockstep.
  REVEAL_DELAY_MS: 2000,

  MAX_SCORE_PER_QUESTION: 1000,
});

module.exports = {
  QuizPhase,
  RuntimeConfig,
};
