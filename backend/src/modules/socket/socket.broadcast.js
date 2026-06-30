const { getIO } = require("./socket.manager");

function broadcastRuntimeState(quizId, runtimeState) {
  console.log("[Broadcast]", quizId, runtimeState.phase);

  const io = getIO();

  io.to(`quiz:${quizId}`).emit("runtimeUpdated", {
    success: true,
    data: runtimeState,
  });
}

module.exports = {
  broadcastRuntimeState,
};
