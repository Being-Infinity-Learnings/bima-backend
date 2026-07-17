// Purpose: Register quiz-specific socket event handlers (join, submit)
// and perform runtime user validation.
const manager = require("../runtime/runtime.manager");
const store = require("../runtime/runtime.store");
const { QuizPhase } = require("../runtime/runtime.constants");

// Register handlers for quiz-related socket events.
function registerQuizEvents(io, socket) {
  socket.on("joinQuiz", async ({ quizId }) => {
    try {
      // IMPORTANT: this used to call manager.loadEngine(quizId) directly,
      // outside any lock, then mutate/broadcast/read off that one snapshot
      // across several awaits. If a phase job (enterQuestion/
      // finishQuestion/enterLeaderboard/...) fired concurrently, this
      // handler's broadcastRuntimeState() could send a stale phase to the
      // whole room right after the phase job's own (correct) broadcast —
      // the same bug that hit the disconnect handler. Routing through
      // store.withLock + manager.withEngine serializes this with
      // submissions/phase-jobs and guarantees fresh state at broadcast
      // time. Everything that needs to read state or mutate it happens
      // inside the locked callback; only the socket.emit calls (no state
      // access) happen after, using values captured from that fresh read.
      const {
        snapshot,
        phase,
        leaderboardPayload,
        questionResults,
        finalResult,
      } = await store.withLock(quizId, () =>
        manager.withEngine(quizId, async (engine) => {
          validateUser(engine.runtime, socket.dbUser);

          socket.join(`quiz:${quizId}`);

          socket.data.quizId = quizId;

          await engine.addConnectedUser(socket.dbUser.id);

          if (!(await engine.isParticipantRegistered(socket.dbUser.id))) {
            await engine.registerParticipant(socket.dbUser);
          }

          // Notify everyone in the lobby about updated participant count
          await engine.broadcastRuntimeState();

          const snapshot = await engine.getRuntimeState();
          const phase = engine.runtime.phase;

          let leaderboardPayload = null;
          let questionResults = null;
          let finalResult = null;

          if (phase === "LEADERBOARD" || phase === QuizPhase.RESULTS) {
            leaderboardPayload = await engine.buildLeaderboardPayload();

            questionResults =
              engine.runtime.lastQuestionResults?.[socket.dbUser.id] ??
              (await engine.buildQuestionResults())[socket.dbUser.id];
          }

          if (phase === QuizPhase.RESULTS) {
            finalResult = engine.runtime.finalResults?.[socket.dbUser.id];
          }

          return {
            snapshot,
            phase,
            leaderboardPayload,
            questionResults,
            finalResult,
          };
        }),
      );

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

      // Guard against two submissions for the same quiz racing on
      // different app instances at the same time (e.g. right at the
      // "everyone answered, finish early" boundary) — see
      // runtime.store.withLock.
      await store.withLock(quizId, () =>
        manager.withEngine(quizId, (engine) =>
          engine.submitAnswer({
            userId: socket.dbUser.id,

            questionId,

            selectedOptionIds,
          }),
        ),
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
