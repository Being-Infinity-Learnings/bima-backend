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

    return getQuestionById(question.id, tx);
  });
}
/** Retrieve questions with server-side pagination and filters */
async function getQuestions(options = {}) {
  const { page, limit, search, type, all } = options;

  const where = {};

  if (search && typeof search === "string" && search.trim()) {
    where.questionText = {
      contains: search.trim(),
      mode: "insensitive",
    };
  }

  if (
    type &&
    ["SINGLE_CORRECT", "MULTI_CORRECT", "TEXT", "NUMERIC"].includes(type)
  ) {
    where.questionType = type;
  }

  // If `all: true` or `all === "true"` is explicitly requested, return all matching items without pagination
  if (all === true || all === "true") {
    const questions = await prisma.question.findMany({
      where,
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

    return {
      results: questions,
      pagination: null,
    };
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (safePage - 1) * safeLimit;

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
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
      skip,
      take: safeLimit,
    }),
    prisma.question.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  return {
    results: questions,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      hasMore: skip + questions.length < total,
    },
  };
}

async function getQuestionById(id, client = prisma) {
  return client.question.findUnique({
    where: { id },

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

    return getQuestionById(id, tx);
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

async function createQuestionsBulk(questionsList, userId) {
  return prisma.$transaction(async (tx) => {
    const createdQuestions = [];

    for (const qData of questionsList) {
      const question = await tx.question.create({
        data: {
          questionText: qData.questionText.trim(),
          questionType: qData.questionType || "SINGLE_CORRECT",
          mediaUrl: qData.mediaUrl?.trim() || null,
          customTimer:
            qData.customTimer !== undefined &&
            qData.customTimer !== null &&
            !isNaN(Number(qData.customTimer)) &&
            Number(qData.customTimer) > 0
              ? parseInt(qData.customTimer, 10)
              : null,
          createdById: userId,
        },
      });

      if (Array.isArray(qData.options) && qData.options.length > 0) {
        await tx.questionOption.createMany({
          data: qData.options.map((option, index) => ({
            questionId: question.id,
            optionText: option.optionText.trim(),
            isCorrect: Boolean(option.isCorrect),
            orderIndex:
              option.orderIndex !== undefined ? option.orderIndex : index + 1,
          })),
        });
      }

      const fullQuestion = await tx.question.findUnique({
        where: { id: question.id },
        include: {
          options: {
            orderBy: { orderIndex: "asc" },
          },
        },
      });

      createdQuestions.push(fullQuestion);
    }

    return createdQuestions;
  });
}

module.exports = {
  createQuestion,
  createQuestionsBulk,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
};
