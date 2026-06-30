const { activeQuizzes } = require("./runtime.state");

function create(runtime, engine) {
  activeQuizzes.set(runtime.quiz.id, {
    runtime,
    engine,
  });

  return runtime;
}

function exists(quizId) {
  return activeQuizzes.has(quizId);
}

function get(quizId) {
  return activeQuizzes.get(quizId);
}

function requireRuntime(id) {
  const entry = activeQuizzes.get(id);

  if (!entry) {
    throw new Error("Runtime not initialized");
  }

  return entry.runtime;
}

function requireEngine(id) {
  const entry = activeQuizzes.get(id);

  if (!entry) {
    throw new Error("Runtime not initialized");
  }

  return entry.engine;
}

function destroy(quizId) {
  activeQuizzes.delete(quizId);
}

function getAll() {
  return [...activeQuizzes.values()];
}

module.exports = {
  create,

  exists,

  get,

  requireRuntime,

  requireEngine,

  destroy,

  getAll,
};
