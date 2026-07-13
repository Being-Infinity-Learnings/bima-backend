// Purpose: Helpers to broadcast runtime-related events to quiz rooms
// or individual users. Both room types (`quiz:{id}` and `user:{id}`)
// work cluster-wide because of the Redis adapter installed in
// socket.server.js — io.to(...)/io.in(...) publish over Redis pub/sub so
// every instance's connected sockets receive the event, not just the
// instance that called emit.
const { getIO } = require("./socket.manager");

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

// Emit per-user question results. Targets each user's personal room
// (`user:{userId}`) instead of a process-local socket lookup, so it
// reaches the user regardless of which instance their socket is on.
function broadcastQuestionResults(results) {
  const io = getIO();

  for (const [userId, payload] of results) {
    io.to(`user:${userId}`).emit("questionResults", {
      success: true,

      data: payload,
    });
  }
}

// Emit final results to each connected user, same room-based targeting.
function broadcastFinalResults(results) {
  const io = getIO();

  for (const [userId, payload] of results) {
    io.to(`user:${userId}`).emit("finalResults", {
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
