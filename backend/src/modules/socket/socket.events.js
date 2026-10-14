// Purpose: Register top-level socket event handlers when a client
// connects, including quiz-related events and graceful disconnect
// handling.
const registerQuizEvents = require("./quiz.socket");
const manager = require("../runtime/runtime.manager");

// Register per-socket event handlers and attach disconnect logic.
function registerEvents(io, socket) {
  console.log(
    `[Socket] Connected: ${socket.dbUser.fullName} (${socket.dbUser.id})`,
  );

  registerQuizEvents(io, socket);

  socket.on("disconnect", async () => {
    const quizId = socket.data.quizId;

    if (quizId) {
      try {
        // No per-quiz lock (see runtime.manager.broadcastIfCurrent). This
        // used to need one: loading state, mutating it, and broadcasting
        // across several awaits, outside any lock, meant a phase job
        // landing in the same instant could have its broadcast overtaken
        // by this handler's stale, already-loaded one — sending every
        // client back to an old phase with a nearly-expired timer.
        // broadcastIfCurrent re-checks the state's version immediately
        // before emitting, so a broadcast this handler builds from stale
        // data simply never gets sent — the phase job's own (correct,
        // newer) broadcast already reached the room instead.
        const engine = await manager.loadEngine(quizId);

        await engine.removeConnectedUser(socket.dbUser.id);

        const snapshot = await engine.getRuntimeState();

        await manager.broadcastIfCurrent(quizId, engine.runtime.version, snapshot);
      } catch (_) {
        // Runtime may already be gone (quiz completed/unpublished) —
        // nothing to clean up in that case.
      }
    }

    console.log(`[Socket] Disconnected: ${socket.dbUser.fullName}`);
  });
}

module.exports = registerEvents;