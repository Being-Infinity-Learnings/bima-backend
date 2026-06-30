const runtimeManager = require("../runtime/runtime.manager");

function registerQuizEvents(io, socket) {
  socket.on("joinQuiz", ({ quizId }) => {
    try {
      const runtime = runtimeManager.requireRuntime(quizId);

      const engine = runtimeManager.requireEngine(quizId);

      validateUser(runtime, socket.dbUser);

      socket.join(`quiz:${quizId}`);

      socket.data.quizId = quizId;

      runtime.connectedUsers.add(socket.dbUser.id);

      socket.emit("quizJoined", {
        success: true,
        data: engine.getRuntimeState(),
      });

      console.log(`[Socket] ${socket.dbUser.fullName} joined quiz ${quizId}`);
    } catch (error) {
      socket.emit("joinQuizError", {
        success: false,

        message: error.message,
      });
    }
  });

  socket.on("submitAnswer", async ({ questionId, selectedOptionIds }) => {
    try {
      const quizId = socket.data.quizId;

      if (!quizId) {
        throw new Error("You are not connected to a quiz.");
      }

      const engine = runtimeManager.requireEngine(quizId);

      const result = await engine.submitAnswer({
        userId: socket.dbUser.id,

        questionId,

        selectedOptionIds,
      });

      socket.emit("answerSubmitted", {
        success: true,

        data: result,
      });
    } catch (error) {
      socket.emit("answerSubmissionError", {
        success: false,

        message: error.message,
      });
    }
  });
}

function validateUser(runtime, user) {
  // Public quizzes are open to everyone.
  if (runtime.quiz.visibility === "PUBLIC") {
    return;
  }

  const allowedGroupIds = runtime.quiz.allowedGroups.map(
    (group) => group.groupId,
  );

  const userGroupIds = user.groupMemberships.map(
    (membership) => membership.groupId,
  );

  const allowed = userGroupIds.some((groupId) =>
    allowedGroupIds.includes(groupId),
  );

  if (!allowed) {
    throw new Error("You are not allowed to participate in this quiz.");
  }
}

module.exports = registerQuizEvents;
