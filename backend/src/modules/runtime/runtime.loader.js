// Purpose: Load quiz data from the database and construct an initial
// in-memory runtime object ready for the runtime engine.
const prisma = require("../../config/prisma");

const { QuizPhase } = require("./runtime.constants");
const { NotFoundError, ValidationError } = require("./runtime.state");

// Load quiz + questions and initialize runtime state for the engine.
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
    // Leaderboard entries look like:
    //   { score, aggregateTimeMs, joinedAt, fullName, profileImage }
    // score: sum of per-question scores (incl. any final-question bonus).
    // aggregateTimeMs: sum of elapsed time for correctly-answered questions,
    //   plus the full question duration for every incorrect/unanswered
    //   question. Lower is better; used as the 1st tie-breaker.
    // joinedAt: when the participant joined the quiz; used as the 2nd
    //   tie-breaker (earlier is better).
    leaderboard: new Map(),

    submissions: new Map(),

    connectedUsers: new Set(),

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
