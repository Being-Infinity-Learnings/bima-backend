const prisma = require("../../config/prisma");

async function createQuestion(data, userId) {
  return prisma.$transaction(async (tx) => {
    const question = await tx.question.create({
      data: {
        questionText: data.questionText,
        questionType: data.questionType ?? "SINGLE_CORRECT",
        mediaUrl: data.mediaUrl ?? null,
        timerSeconds: data.timerSeconds,
        createdById: userId,
      },
    });

    await tx.questionOption.createMany({
      data: data.options.map((option, index) => ({
        questionId: question.id,
        optionText: option.optionText,
        isCorrect: option.isCorrect,
        orderIndex: index + 1,
      })),
    });

    return question;
  });
}

async function getQuestions() {
  return prisma.question.findMany({
    include: {
      options: {
        orderBy: {
          orderIndex: "asc",
        },
      },

      createdBy: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}

async function getQuestionById(id) {
  return prisma.question.findUnique({
    where: { id },

    include: {
      options: {
        orderBy: {
          orderIndex: "asc",
        },
      },
    },
  });
}

async function updateQuestion(id, data) {
  return prisma.$transaction(async (tx) => {
    await tx.question.update({
      where: { id },

      data: {
        questionText: data.questionText,
        questionType: data.questionType,
        mediaUrl: data.mediaUrl,
        timerSeconds: data.timerSeconds,
      },
    });

    await tx.questionOption.deleteMany({
      where: {
        questionId: id,
      },
    });

    await tx.questionOption.createMany({
      data: data.options.map((option, index) => ({
        questionId: id,
        optionText: option.optionText,
        isCorrect: option.isCorrect,
        orderIndex: index + 1,
      })),
    });

    return getQuestionById(id);
  });
}

async function deleteQuestion(id) {
  const usageCount = await prisma.quizQuestionMap.count({
    where: {
      questionId: id,
    },
  });

  if (usageCount > 0) {
    throw new Error("Question is being used by one or more quizzes");
  }

  return prisma.question.delete({
    where: {
      id,
    },
  });
}

module.exports = {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
};
