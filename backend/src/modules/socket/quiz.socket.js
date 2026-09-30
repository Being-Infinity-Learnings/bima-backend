// Purpose: Register quiz-specific socket event handlers (join, submit)
// and perform runtime user validation.
const manager = require("../runtime/runtime.manager");
const { QuizPhase } = require("../runtime/runtime.constants");

// Register handlers for quiz-related socket events.
function registerQuizEvents(io, socket) {
  socket.on("joinQuiz", async ({ quizId }) => {
    try {
      // No per-quiz lock (see runtime.manager.broadcastIfCurrent for the
      // mechanism that replaces it). Validation and joining never need to
      // be ordered against a phase transition or against a different
      // user's join — only the room-wide broadcast at the end does, and
      // that's handled by re-checking the state's version immediately
      // before emitting instead of holding a lock the whole time through.
      const initial = await manager.loadEngine(quizId);

      validateUser(initial.runtime, socket.dbUser);

      socket.join(`quiz:${quizId}`);

      socket.data.quizId = quizId;

      // Marks connected + registers as a participant (first join only) +
      // returns the fresh connected count, all in one atomic round trip.
      // Doesn't touch the state blob, so it can't change its version.
      const connectedCount = await initial.joinParticipant(socket.dbUser);

      // Reload fresh rather than reusing `initial` — gives this joiner
      // the most current possible view, and its version becomes the
      // baseline the broadcast check re-verifies against right before
      // emitting.
      const fresh = await manager.loadEngine(quizId);
      const snapshot = await fresh.getRuntimeState(connectedCount);
      const phase = fresh.runtime.phase;

      let leaderboardPayload = null;
      let questionResults = null;
      let finalResult = null;

      if (phase === "LEADERBOARD" || phase === QuizPhase.RESULTS) {
        leaderboardPayload = await fresh.buildLeaderboardPayload();

        questionResults =
          fresh.runtime.lastQuestionResults?.[socket.dbUser.id] ??
          (await fresh.buildQuestionResults())[socket.dbUser.id];
      }

      if (phase === QuizPhase.RESULTS) {
        finalResult = fresh.runtime.finalResults?.[socket.dbUser.id];
      }

      socket.emit("quizJoined", {
        success: true,
        data: snapshot,
      });

      if (phase === "LEADERBOARD" || phase === QuizPhase.RESULTS) {
        socket.emit("leaderboardUpdated", {
          success: true,
          data: leaderboardPayload,
        });

        socket.emit("questionResults", {
          success: true,
          data: questionResults,
        });
      }

      if (phase === QuizPhase.RESULTS) {
        socket.emit("finalResults", {
          success: true,
          data: finalResult,
        });
      }

      // Notify everyone in the lobby about the updated participant count —
      // but only if nothing has changed since `fresh` was read. If a
      // phase transition landed in between, its own broadcast already
      // delivered the correct, newer state; sending this one now would
      // show the room a stale phase for a moment.
      await manager.broadcastIfCurrent(quizId, fresh.runtime.version, snapshot);

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

      // No per-quiz lock here (unlike joinQuiz below) — submitAnswer()'s
      // leaderboard math, duplicate check, and "everyone answered"
      // detection are all atomic on their own (store.recordSubmission),
      // and the one race that DID need the lock — a submission landing at
      // the exact instant a question closes — is now handled by
      // finishQuestion() atomically closing submissions first. See
      // loadtest/quiz/LOCK-REMOVAL.md.
      await manager.withEngine(quizId, (engine) =>
        engine.submitAnswer({
          userId: socket.dbUser.id,

          questionId,

          selectedOptionIds,
        }),
      );

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
