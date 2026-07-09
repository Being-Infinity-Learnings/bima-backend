// Purpose: Register top-level socket event handlers when a client
// connects, including quiz-related events and graceful disconnect
// handling.
const registerQuizEvents = require("./quiz.socket");
const socketManager = require("./socket.manager");

// Register per-socket event handlers and attach disconnect logic.
function registerEvents(io, socket) {
  console.log(
    `[Socket] Connected: ${socket.dbUser.fullName} (${socket.dbUser.id})`,
  );

  registerQuizEvents(io, socket);

  socket.on("disconnect", () => {
    const quizId = socket.data.quizId;

    if (quizId) {
      try {
        const runtime = require("../runtime/runtime.manager").requireRuntime(
          quizId,
        );

        runtime.connectedUsers.delete(socket.dbUser.id);
      } catch (_) {}
    }
    socketManager.unregisterSocket(socket.dbUser.id);
    console.log(`[Socket] Disconnected: ${socket.dbUser.fullName}`);
  });
}

module.exports = registerEvents;
