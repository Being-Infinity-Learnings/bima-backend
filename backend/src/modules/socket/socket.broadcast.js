const { getIO, getSocket } = require("./socket.manager");

function broadcastRuntimeState(quizId, runtimeState) {
  console.log("[Broadcast]", quizId, runtimeState.phase);

  const io = getIO();

  io.to(`quiz:${quizId}`).emit("runtimeUpdated", {
    success: true,
    data: runtimeState,
  });
}

function broadcastLeaderboard(quizId, payload) {
  const io = getIO();

  io.to(`quiz:${quizId}`).emit("leaderboardUpdated", {
    success: true,

    data: payload,
  });
}
function broadcastQuestionResults(results) {
  for (const [userId, payload] of results) {
    const socket = getSocket(userId);

    if (!socket) {
      continue;
    }

    socket.emit("questionResults", {
      success: true,

      data: payload,
    });
  }
}

function broadcastFinalResults(results) {
  for (const [userId, payload] of results) {
    const socket = getSocket(userId);

    if (!socket) {
      continue;
    }

    socket.emit("finalResults", {
      success: true,
      data: payload,
    });
  }
}

module.exports = {
  broadcastRuntimeState,

  broadcastLeaderboard,

  broadcastQuestionResults,

  broadcastFinalResults,
};
