// Purpose: Register quiz-specific socket event handlers (join, submit)
// and perform runtime user validation.
const runtimeManager = require("../runtime/runtime.manager");
const socketManager = require("./socket.manager");
const { QuizPhase } = require("../runtime/runtime.constants");

// Register handlers for quiz-related socket events.
function registerQuizEvents(io, socket) {
  socket.on("joinQuiz", ({ quizId }) => {
    try {
      const runtime = runtimeManager.requireRuntime(quizId);

      const engine = runtimeManager.requireEngine(quizId);

      validateUser(runtime, socket.dbUser);

      socket.join(`quiz:${quizId}`);
      socketManager.registerSocket(socket.dbUser.id, socket);

      socket.data.quizId = quizId;

      runtime.connectedUsers.add(socket.dbUser.id);

      if (!engine.isParticipantRegistered(socket.dbUser.id)) {
        engine.registerParticipant(socket.dbUser);
      }

      socket.emit("quizJoined", {
        success: true,
        data: engine.getRuntimeState(),
      });

      if (
        runtime.phase === "LEADERBOARD" ||
        runtime.phase === QuizPhase.RESULTS
      ) {
        socket.emit("leaderboardUpdated", {
          success: true,
          data: engine.buildLeaderboardPayload(),
        });

        const questionResults =
          runtime.lastQuestionResults?.get(socket.dbUser.id) ??
          engine.buildQuestionResults().get(socket.dbUser.id);

        socket.emit("questionResults", {
          success: true,
          data: questionResults,
        });
      }

      if (runtime.phase === QuizPhase.RESULTS) {
        const result = runtime.finalResults.get(socket.dbUser.id);

        socket.emit("finalResults", {
          success: true,
          data: result,
        });
      }

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
      });
    } catch (error) {
      socket.emit("answerSubmissionError", {
        success: false,

        message: error.message,
      });
    }
  });
}

// Validate that a user is allowed to join the quiz based on visibility
// and group membership.
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
