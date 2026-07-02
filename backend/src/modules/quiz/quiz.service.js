const prisma = require("../../config/prisma");
const validationService = require("./quiz-validation.service");
const imageService = require("../upload/image.service");
const runtimeManager = require("../runtime/runtime.manager");

/**
 * Resolves the coverImageUrl for a quiz create/update payload.
 * - If `coverImageBase64` is present, the image is uploaded to S3 now (only
 *   once the quiz is actually being saved) and the resulting URL is used.
 * - Otherwise falls back to an explicit `coverImageUrl` (e.g. unchanged on
 *   edit, or null to remove the image).
 */
async function resolveCoverImageUrl(data) {
  if (data.coverImageBase64) {
    return imageService.uploadBase64Image(data.coverImageBase64, "quiz-covers");
  }

  if (data.coverImageUrl !== undefined) {
    return data.coverImageUrl;
  }

  return undefined;
}

/** Create a new quiz */
async function createQuiz(data, userId) {
  if (!data.scheduledStartTime) {
    throw new Error("Scheduled start time is required");
  }

  if (data.defaultTimer === undefined) {
    throw new Error("Default timer is required");
  }

  const coverImageUrl = await resolveCoverImageUrl(data);

  return prisma.quiz.create({
    data: {
      title: data.title,

      description: data.description ?? null,

      coverImageUrl: coverImageUrl ?? null,

      visibility: data.visibility ?? "PUBLIC",

      defaultTimer: data.defaultTimer,

      scheduledStartTime: new Date(data.scheduledStartTime),

      status: "DRAFT",

      createdById: userId,
    },
  });
}

/** Retrieve all quizzes */
async function getQuizzes() {
  return prisma.quiz.findMany({
    include: {
      createdBy: {
        select: {
          id: true,
          fullName: true,
        },
      },

      _count: {
        select: {
          quizQuestions: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}

/** Retrieve a quiz by its ID */
async function getQuizById(id) {
  return prisma.quiz.findUnique({
    where: { id },

    include: {
      createdBy: {
        select: {
          id: true,
          fullName: true,
        },
      },

      allowedGroups: {
        include: {
          group: true,
        },
      },

      _count: {
        select: {
          quizQuestions: true,
        },
      },
    },
  });
}

/** Update an existing quiz */
async function updateQuiz(id, data) {
  const updateData = {};

  if (data.title !== undefined) updateData.title = data.title;

  if (data.description !== undefined) updateData.description = data.description;

  const coverImageUrl = await resolveCoverImageUrl(data);
  if (coverImageUrl !== undefined) updateData.coverImageUrl = coverImageUrl;

  if (data.visibility !== undefined) updateData.visibility = data.visibility;

  if (data.defaultTimer !== undefined) {
    updateData.defaultTimer = data.defaultTimer;
  }

  if (data.scheduledStartTime !== undefined) {
    updateData.scheduledStartTime = new Date(data.scheduledStartTime);
  }

  return prisma.quiz.update({
    where: { id },
    data: updateData,
  });
}

/** Delete a quiz */
async function deleteQuiz(id) {
  return prisma.quiz.delete({
    where: {
      id,
    },
  });
}

/** Publish a quiz */
async function publishQuiz(id) {
  await validationService.validateQuiz(id);

  const quiz = await prisma.quiz.findUnique({
    where: {
      id,
    },
  });

  if (!quiz) {
    throw new Error("Quiz not found");
  }

  if (quiz.status !== "DRAFT") {
    throw new Error("Only draft quizzes can be published");
  }

  return prisma.quiz.update({
    where: {
      id,
    },

    data: {
      status: "SCHEDULED",
    },
  });
}

/** Unpublish a quiz */
async function unpublishQuiz(id) {
  const quiz = await prisma.quiz.findUnique({
    where: {
      id,
    },
  });

  if (!quiz) {
    throw new Error("Quiz not found");
  }

  if (quiz.status !== "SCHEDULED") {
    throw new Error("Only scheduled quizzes can be unpublished");
  }

  return prisma.quiz.update({
    where: {
      id,
    },

    data: {
      status: "DRAFT",
    },
  });
}

/** Add groups to a quiz */
async function addGroupsToQuiz(quizId, groupIds) {
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    throw new Error("groupIds must be a non-empty array");
  }

  const quiz = await prisma.quiz.findUnique({
    where: {
      id: quizId,
    },
  });

  if (!quiz) {
    throw new Error("Quiz not found");
  }

  const groups = await prisma.group.findMany({
    where: {
      id: {
        in: groupIds,
      },
    },
  });

  if (groups.length !== groupIds.length) {
    throw new Error("One or more group IDs are invalid");
  }

  const existing = await prisma.quizAllowedGroup.findMany({
    where: {
      quizId,
      groupId: {
        in: groupIds,
      },
    },
  });

  const existingIds = new Set(existing.map((g) => g.groupId));

  const mappings = groupIds
    .filter((id) => !existingIds.has(id))
    .map((groupId) => ({
      quizId,
      groupId,
    }));

  if (mappings.length === 0) {
    throw new Error("All groups already attached");
  }

  await prisma.quizAllowedGroup.createMany({
    data: mappings,
  });

  return {
    addedCount: mappings.length,
  };
}

/** Get groups associated with a quiz */
async function getQuizGroups(quizId) {
  return prisma.quizAllowedGroup.findMany({
    where: {
      quizId,
    },

    include: {
      group: true,
    },
  });
}

/** Remove a group from a quiz */
async function removeGroupFromQuiz(quizId, groupId) {
  return prisma.quizAllowedGroup.delete({
    where: {
      quizId_groupId: {
        quizId,
        groupId,
      },
    },
  });
}

/** Get quizzes that the user can access */
async function getMyQuizzes(user) {
  return prisma.quiz.findMany({
    where: {
      status: {
        in: ["SCHEDULED", "LIVE"],
      },

      OR: [
        {
          visibility: "PUBLIC",
        },

        {
          visibility: "RESTRICTED",

          allowedGroups: {
            some: {
              groupId: {
                in: user.groupMemberships.map(
                  (membership) => membership.groupId,
                ),
              },
            },
          },
        },
      ],
    },

    select: {
      id: true,

      title: true,

      coverImageUrl: true,

      scheduledStartTime: true,

      status: true,

      visibility: true,

      _count: {
        select: {
          quizQuestions: true,
        },
      },
    },

    orderBy: {
      scheduledStartTime: "asc",
    },
  });
}

async function getMyQuizById(quizId, user) {
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,

      status: {
        in: ["SCHEDULED", "LIVE"],
      },

      OR: [
        {
          visibility: "PUBLIC",
        },

        {
          visibility: "RESTRICTED",

          allowedGroups: {
            some: {
              groupId: {
                in: user.groupMemberships.map(
                  (membership) => membership.groupId,
                ),
              },
            },
          },
        },
      ],
    },

    select: {
      id: true,
      title: true,
      description: true,
      coverImageUrl: true,
      visibility: true,
      scheduledStartTime: true,
      defaultTimer: true,
      status: true,

      _count: {
        select: {
          quizQuestions: true,
        },
      },
    },
  });

  if (!quiz) {
    throw new Error("Quiz not found");
  }

  const runtime = runtimeManager.getRuntime(quiz.id);

  return {
    ...quiz,

    runtime: runtime
      ? {
          phase: runtime.phase,

          remainingTime: runtime.phaseEndsAt
            ? Math.max(runtime.phaseEndsAt.getTime() - Date.now(), 0)
            : null,
          phaseStartedAt: runtime.phaseStartedAt?.toISOString() ?? null,
          phaseEndsAt: runtime.phaseEndsAt?.toISOString() ?? null,
        }
      : null,
  };
}

module.exports = {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  publishQuiz,
  unpublishQuiz,
  addGroupsToQuiz,
  getQuizGroups,
  removeGroupFromQuiz,
  getMyQuizzes,
  getMyQuizById,
};
