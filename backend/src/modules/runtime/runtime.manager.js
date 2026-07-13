// Purpose: Manage active runtime instances via Redis (see runtime.store.js)
// instead of an in-memory Map, so any app instance or worker process can
// initialize, load, mutate, and destroy a quiz's runtime.
//
// Pattern: load the core state from Redis, build a fresh RuntimeEngine
// around it, let the caller mutate it, then persist the (possibly
// mutated) core state back to Redis. Leaderboard/submissions/connected
// users are NOT part of this round trip — engine methods read/write
// those directly against Redis (via runtime.store) so they take effect
// immediately regardless of this wrapper.
const store = require("./runtime.store");
const RuntimeEngine = require("./runtime.engine");
const { NotFoundError, ConflictError } = require("./runtime.state");

// Check whether a runtime exists for the given quiz id.
async function exists(quizId) {
  return store.stateExists(quizId);
}

// Create a runtime entry from an initial core-state object (see
// runtime.loader.js). Throws if one already exists for this quiz.
async function create(initialState) {
  if (await store.stateExists(initialState.quiz.id)) {
    throw new ConflictError("Runtime already initialized");
  }

  await store.saveState(initialState.quiz.id, initialState);

  return initialState;
}

// Load a quiz's core state from Redis and wrap it in a RuntimeEngine, or
// throw if no runtime is initialized for this quiz.
async function loadEngine(quizId) {
  const state = await store.loadState(quizId);

  if (!state) {
    throw new NotFoundError("Runtime not initialized");
  }

  return new RuntimeEngine(reviveDates(state));
}

// Run `fn(engine)` against a freshly loaded engine for `quizId`, then
// persist the engine's (possibly mutated) core state back to Redis. This
// is the standard entry point for every runtime mutation — HTTP
// controllers, socket handlers, and BullMQ job processors should all go
// through this instead of holding onto an engine instance across calls.
async function withEngine(quizId, fn) {
  const engine = await loadEngine(quizId);

  const result = await fn(engine);

  // engine.complete() deletes all Redis keys for this quiz itself; don't
  // resurrect the state key by saving again afterwards.
  if (!engine._destroyed) {
    await store.saveState(quizId, engine.runtime);
  }

  return result;
}

// Destroy every Redis key associated with a quiz's runtime (core state,
// leaderboard, submissions, connected users).
async function destroy(quizId) {
  await store.deleteAll(quizId);
}

// Convenience: return the raw core-state snapshot for a quiz id, or null.
// Used by read-only endpoints (e.g. getMyQuizById) that just need current
// phase/timing without needing a full engine instance.
async function getRuntimeSnapshot(quizId) {
  const state = await store.loadState(quizId);
  return state ? reviveDates(state) : null;
}

// JSON.parse turns our Date fields back into strings — convert the ones
// the engine relies on being real Dates back.
function reviveDates(state) {
  return {
    ...state,
    phaseStartedAt: state.phaseStartedAt
      ? new Date(state.phaseStartedAt)
      : null,
    phaseEndsAt: state.phaseEndsAt ? new Date(state.phaseEndsAt) : null,
    initializedAt: state.initializedAt ? new Date(state.initializedAt) : null,
    startedAt: state.startedAt ? new Date(state.startedAt) : null,
    completedAt: state.completedAt ? new Date(state.completedAt) : null,
  };
}

module.exports = {
  exists,
  create,
  loadEngine,
  withEngine,
  destroy,
  getRuntimeSnapshot,
};
