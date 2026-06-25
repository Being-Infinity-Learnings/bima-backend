const prisma = require("../../config/prisma");

/** Validate a quiz before publishing */
async function validateQuiz(quizId) {
  const quiz = await prisma.quiz.findUnique({
    where: {
      id: quizId,
    },

    include: {
      allowedGroups: true,

      quizQuestions: {
        include: {
          question: {
            include: {
              options: true,
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    throw new Error("Quiz not found");
  }

  if (!quiz.title?.trim()) {
    throw new Error("Quiz title is required");
  }

  if (quiz.defaultTimer == null) {
    throw new Error("Quiz default timer is required");
  }

  if (quiz.defaultTimer <= 0) {
    throw new Error("Quiz default timer must be greater than zero");
  }

  if (!quiz.scheduledStartTime) {
    throw new Error("Scheduled start time is required");
  }

  if (quiz.scheduledStartTime <= new Date()) {
    throw new Error("Scheduled start time must be in the future");
  }

  if (quiz.quizQuestions.length === 0) {
    throw new Error("Quiz must contain at least one question");
  }

  if (quiz.visibility === "RESTRICTED" && quiz.allowedGroups.length === 0) {
    throw new Error("Restricted quizzes must have at least one group");
  }

  for (const mapping of quiz.quizQuestions) {
    const question = mapping.question;

    if (question.customTimer != null && question.customTimer <= 0) {
      throw new Error(
        `Question "${question.questionText}" has an invalid custom timer`,
      );
    }

    if (!question) {
      throw new Error("Quiz contains an invalid question reference");
    }

    if (!question.options.length) {
      throw new Error(`Question "${question.questionText}" has no options`);
    }

    const correctOptions = question.options.filter(
      (option) => option.isCorrect,
    );

    switch (question.questionType) {
      case "SINGLE_CORRECT":
        if (correctOptions.length !== 1) {
          throw new Error(
            `Question "${question.questionText}" must have exactly one correct answer`,
          );
        }
        break;

      case "MULTI_CORRECT":
        if (correctOptions.length === 0) {
          throw new Error(
            `Question "${question.questionText}" must have at least one correct answer`,
          );
        }
        break;

      default:
        break;
    }
  }

  return true;
}

module.exports = {
  validateQuiz,
};
