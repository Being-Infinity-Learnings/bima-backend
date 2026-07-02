// Purpose: In-memory store for active quiz runtimes. Keys are quiz ids
// and values are objects containing `runtime` and `engine`.
const activeQuizzes = new Map();

module.exports = {
  activeQuizzes,
};
