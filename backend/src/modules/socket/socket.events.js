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
        const engine = await manager.loadEngine(quizId);

        await engine.removeConnectedUser(socket.dbUser.id);

        // Broadcast updated lobby count
        await engine.broadcastRuntimeState();
      } catch (_) {
        // Runtime may already be gone (quiz completed/unpublished) —
        // nothing to clean up in that case.
      }
    }

    console.log(`[Socket] Disconnected: ${socket.dbUser.fullName}`);
  });
}

module.exports = registerEvents;
