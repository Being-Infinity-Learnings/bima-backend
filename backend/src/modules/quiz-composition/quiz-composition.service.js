const prisma = require("../../config/prisma");

/** Add questions to a quiz */
async function addQuestionsToQuiz(quizId, questionIds) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw new Error("questionIds must be a non-empty array");
  }

  const uniqueQuestionIds = [...new Set(questionIds)];

  if (uniqueQuestionIds.length !== questionIds.length) {
    throw new Error("Duplicate question IDs found in request");
  }

  const questions = await prisma.question.findMany({
    where: {
      id: {
        in: questionIds,
      },
    },
  });

  if (questions.length !== questionIds.length) {
    throw new Error("One or more question IDs are invalid");
  }

  const quiz = await prisma.quiz.findUnique({
    where: {
      id: quizId,
    },
  });

  if (!quiz) {
    throw new Error("Quiz not found");
  }

  const existingMappings = await prisma.quizQuestionMap.findMany({
    where: {
      quizId,
      questionId: {
        in: questionIds,
      },
    },
  });

  const existingIds = new Set(
    existingMappings.map((mapping) => mapping.questionId),
  );

  const currentCount = await prisma.quizQuestionMap.count({
    where: {
      quizId,
    },
  });

  const mappingsToCreate = questionIds
    .filter((id) => !existingIds.has(id))
    .map((questionId, index) => ({
      quizId,
      questionId,
      orderIndex: currentCount + index + 1,
    }));

  if (mappingsToCreate.length === 0) {
    throw new Error("All selected questions already exist in quiz");
  }

  await prisma.quizQuestionMap.createMany({
    data: mappingsToCreate,
  });

  return {
    addedCount: mappingsToCreate.length,
  };
}

/** Get questions of a quiz */
async function getQuizQuestions(quizId) {
  return prisma.quizQuestionMap.findMany({
    where: {
      quizId,
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

    orderBy: {
      orderIndex: "asc",
    },
  });
}

/** Remove a question from a quiz */
async function removeQuestionFromQuiz(quizId, questionId) {
  return prisma.quizQuestionMap.delete({
    where: {
      quizId_questionId: {
        quizId,
        questionId,
      },
    },
  });
}
/** Reorder questions in a quiz */
async function reorderQuizQuestions(quizId, questionIds) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw new Error("questionIds must be a non-empty array");
  }

  // Get all questions currently attached to the quiz
  const existingMappings = await prisma.quizQuestionMap.findMany({
    where: {
      quizId,
    },
    select: {
      questionId: true,
    },
  });

  const existingIds = existingMappings.map((mapping) => mapping.questionId);

  // Make sure frontend sent every question exactly once
  if (existingIds.length !== questionIds.length) {
    throw new Error("All quiz questions must be included in reorder request");
  }

  const existingSet = new Set(existingIds);

  for (const questionId of questionIds) {
    if (!existingSet.has(questionId)) {
      throw new Error(`Question ${questionId} does not belong to this quiz`);
    }
  }

  // Prevent duplicate IDs in request
  const uniqueIds = new Set(questionIds);

  if (uniqueIds.size !== questionIds.length) {
    throw new Error("Duplicate question IDs found in reorder request");
  }

  return prisma.$transaction(
    questionIds.map((questionId, index) =>
      prisma.quizQuestionMap.update({
        where: {
          quizId_questionId: {
            quizId,
            questionId,
          },
        },
        data: {
          orderIndex: index + 1,
        },
      }),
    ),
  );
}

module.exports = {
  addQuestionsToQuiz,
  getQuizQuestions,
  removeQuestionFromQuiz,
  reorderQuizQuestions,
};
