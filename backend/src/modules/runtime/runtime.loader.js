// Purpose: Load quiz data from the database and construct the initial
// runtime "core state" object (phase/timing/current-question/results).
// Leaderboard, submissions and connected-users are NOT part of this
// object anymore — they live directly in Redis (see runtime.store.js)
// and are read/written independently of this core state blob.
const prisma = require("../../config/prisma");

const { QuizPhase } = require("./runtime.constants");
const { NotFoundError, ValidationError } = require("./runtime.state");

// Load quiz + questions and build the initial core runtime state.
async function load(quizId) {
  const quiz = await prisma.quiz.findUnique({
    where: {
      id: quizId,
    },

    include: {
      quizQuestions: {
        orderBy: {
          orderIndex: "asc",
        },

        include: {
          question: {
            include: {
              options: {
                orderBy: {
                  orderIndex: "asc",
                },
              },
            },
          },
        },
      },

      allowedGroups: {
        include: {
          group: true,
        },
      },
    },
  });

  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }

  if (quiz.status !== "SCHEDULED") {
    throw new ValidationError("Only scheduled quizzes can be initialized");
  }

  const runtime = {
    // Static Quiz Data (cached here so we don't re-query the DB on every
    // phase transition/job — this is fine to duplicate into Redis since
    // it's read-heavy and only set once at initialization).
    quiz,

    questions: quiz.quizQuestions.map((mapping) => ({
      orderIndex: mapping.orderIndex,

      ...mapping.question,
    })),

    // Runtime State
    phase: QuizPhase.WAITING,

    currentQuestionIndex: -1,

    currentQuestion: null,

    phaseStartedAt: null,

    phaseEndsAt: null,

    currentDurationMs: null,

    // Per-question reveal payload and final results, stored as plain
    // objects ({userId: payload}) since JSON can't represent a Map.
    lastQuestionResults: null,

    finalResults: null,

    // Metadata
    initializedAt: new Date(),

    startedAt: null,

    completedAt: null,
  };

  return runtime;
}

module.exports = {
  load,
};
