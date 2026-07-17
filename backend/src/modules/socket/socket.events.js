// Purpose: Register top-level socket event handlers when a client
// connects, including quiz-related events and graceful disconnect
// handling.
const registerQuizEvents = require("./quiz.socket");
const manager = require("../runtime/runtime.manager");
const store = require("../runtime/runtime.store");

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
        // IMPORTANT: this used to call manager.loadEngine(quizId) directly,
        // outside any lock, and then broadcast that snapshot. If a phase
        // job (enterQuestion/finishQuestion/enterLeaderboard/...) landed
        // in the same instant, this handler's stale, already-loaded state
        // could broadcast AFTER the phase job's own broadcast, sending
        // every client back to the previous phase with an old, nearly-
        // expired timer. Routing through the same store.withLock +
        // manager.withEngine that submissions/phase-jobs use serializes
        // this with them and guarantees we load fresh state right before
        // broadcasting, so it can never "win" a race with a stale view.
        await store.withLock(quizId, () =>
          manager.withEngine(quizId, async (engine) => {
            await engine.removeConnectedUser(socket.dbUser.id);

            // Broadcast updated lobby count
            await engine.broadcastRuntimeState();
          }),
        );
      } catch (_) {
        // Runtime may already be gone (quiz completed/unpublished) —
        // nothing to clean up in that case.
      }
    }

    console.log(`[Socket] Disconnected: ${socket.dbUser.fullName}`);
  });
}

module.exports = registerEvents;