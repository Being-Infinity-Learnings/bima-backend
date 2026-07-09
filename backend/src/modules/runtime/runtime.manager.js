// Purpose: Manage active runtime instances in memory. Provides helpers
// to create, retrieve, and destroy runtime and engine pairs.
const {
  activeQuizzes,
  NotFoundError,
  ConflictError,
} = require("./runtime.state");

// Create a runtime entry and associate an engine instance with it.
function create(runtime, engine) {
  if (activeQuizzes.has(runtime.quiz.id)) {
    throw new ConflictError("Runtime already initialized");
  }

  activeQuizzes.set(runtime.quiz.id, {
    runtime,
    engine,
  });

  return runtime;
}

// Check whether a runtime exists for the given quiz id.
function exists(quizId) {
  return activeQuizzes.has(quizId);
}

// Get the runtime entry (runtime + engine) for a quiz id.
function get(quizId) {
  return activeQuizzes.get(quizId);
}

// Require and return only the runtime object for a quiz id, or throw
// if missing.
function requireRuntime(id) {
  const entry = activeQuizzes.get(id);

  if (!entry) {
    throw new NotFoundError("Runtime not initialized");
  }

  return entry.runtime;
}

// Require and return the engine instance for a quiz id, or throw if
// missing.
function requireEngine(id) {
  const entry = activeQuizzes.get(id);

  if (!entry) {
    throw new NotFoundError("Runtime not initialized");
  }

  return entry.engine;
}

// Destroy a runtime entry for a quiz id.
function destroy(quizId) {
  activeQuizzes.delete(quizId);
}

// Return all runtime entries as an array.
function getAll() {
  return [...activeQuizzes.values()];
}

// Convenience: return only the runtime object for a quiz id or null.
function getRuntime(quizId) {
  return activeQuizzes.get(quizId)?.runtime ?? null;
}

module.exports = {
  create,

  exists,

  get,

  requireRuntime,

  requireEngine,

  destroy,

  getAll,

  getRuntime,
};
