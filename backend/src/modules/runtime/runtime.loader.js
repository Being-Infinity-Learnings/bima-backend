const prisma = require("../../config/prisma");

const { QuizPhase } = require("./runtime.constants");

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
    throw new Error("Quiz not found");
  }

  if (quiz.status !== "SCHEDULED") {
    throw new Error("Only scheduled quizzes can be initialized");
  }

  const runtime = {
    // Static Quiz Data

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

    timeoutHandle: null,

    currentDurationMs: null,

    // Live Data
    leaderboard: new Map(),

    submissions: new Map(),

    connectedUsers: new Set(),

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
