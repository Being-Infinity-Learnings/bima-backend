// Purpose: Helpers to broadcast runtime-related events to quiz rooms
// or individual users using the socket manager/IO instance.
const { getIO, getSocket } = require("./socket.manager");

// Emit the canonical runtime state to the quiz room.
function broadcastRuntimeState(quizId, runtimeState) {
  console.log("[Broadcast]", quizId, runtimeState.phase);

  const io = getIO();

  io.to(`quiz:${quizId}`).emit("runtimeUpdated", {
    success: true,
    data: runtimeState,
  });
}

// Emit a leaderboard update to the quiz room.
function broadcastLeaderboard(quizId, payload) {
  const io = getIO();

  io.to(`quiz:${quizId}`).emit("leaderboardUpdated", {
    success: true,

    data: payload,
  });
}

// Emit per-user question results to each connected socket.
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

// Emit final results to each connected user.
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
