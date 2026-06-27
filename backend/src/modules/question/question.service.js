const prisma = require("../../config/prisma");
const imageService = require("../upload/image.service");

/**
 * Resolves the mediaUrl for a question create/update payload.
 * - If `imageBase64` is present, the image is uploaded to S3 now (i.e. only
 *   once the question is actually being saved) and the resulting URL is used.
 * - Otherwise falls back to an explicit `mediaUrl` (e.g. unchanged on edit,
 *   or null to remove the image).
 */
async function resolveMediaUrl(data) {
  if (data.imageBase64) {
    return imageService.uploadBase64Image(data.imageBase64, "question-images");
  }

  if (data.mediaUrl !== undefined) {
    return data.mediaUrl;
  }

  return undefined;
}

async function createQuestion(data, userId) {
  const mediaUrl = await resolveMediaUrl(data);

  return prisma.$transaction(async (tx) => {
    const question = await tx.question.create({
      data: {
        questionText: data.questionText,

        questionType: data.questionType ?? "SINGLE_CORRECT",

        mediaUrl: mediaUrl ?? null,

        customTimer: data.customTimer !== undefined ? data.customTimer : null,

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
  const mediaUrl = await resolveMediaUrl(data);

  return prisma.$transaction(async (tx) => {
    const updateData = {};

    if (data.questionText !== undefined)
      updateData.questionText = data.questionText;

    if (data.questionType !== undefined)
      updateData.questionType = data.questionType;

    if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;

    if (data.customTimer !== undefined)
      updateData.customTimer = data.customTimer;

    await tx.question.update({
      where: { id },
      data: updateData,
    });

    if (data.options !== undefined) {
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
    }

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
