const prisma = require("../../config/prisma");
const validationService = require("./quiz-validation.service");
const imageService = require("../upload/image.service");
const runtimeManager = require("../runtime/runtime.manager");
const { RuntimeConfig } = require("../runtime/runtime.constants");
const {
  scheduleQuizStart,
  cancelQuizStart,
} = require("../runtime/quiz-start.queue");

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
  const existingQuiz = await prisma.quiz.findUnique({
    where: { id },
    select: {
      status: true,
      scheduledStartTime: true,
    },
  });

  if (!existingQuiz) {
    throw new Error("Quiz not found");
  }

  // Only allow updates for DRAFT and SCHEDULED quizzes
  if (existingQuiz.status !== "DRAFT" && existingQuiz.status !== "SCHEDULED") {
    throw new Error(
      "Quiz can only be edited when it is in DRAFT or SCHEDULED state",
    );
  }

  const updateData = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.coverImageUrl !== undefined) {
    updateData.coverImageUrl = data.coverImageUrl;
  }
  if (data.visibility !== undefined) {
    updateData.visibility = data.visibility;
  }
  if (data.defaultTimer !== undefined) {
    updateData.defaultTimer = data.defaultTimer;
  }
  if (data.scheduledStartTime !== undefined) {
    updateData.scheduledStartTime = new Date(data.scheduledStartTime);
  }

  const updated = await prisma.quiz.update({
    where: { id },
    data: updateData,
  });

  // A DRAFT quiz has no BullMQ start job to touch. A SCHEDULED quiz does
  // — if its scheduledStartTime just changed, reschedule (cancel + add)
  // so it still starts at (new scheduledStartTime - lobby time).
  const startTimeChanged =
    data.scheduledStartTime !== undefined &&
    new Date(data.scheduledStartTime).getTime() !==
      existingQuiz.scheduledStartTime.getTime();

  if (existingQuiz.status === "SCHEDULED" && startTimeChanged) {
    await scheduleQuizStart(
      id,
      updated.scheduledStartTime,
      RuntimeConfig.LOBBY_DURATION_MS,
    );
  }

  return updated;
}

/** Delete a quiz */
async function deleteQuiz(id) {
  // Clean up any pending start job and any (unlikely, but possible)
  // already-initialized runtime before removing the quiz row itself.
  await cancelQuizStart(id);
  await runtimeManager.destroy(id);

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

  const updated = await prisma.quiz.update({
    where: {
      id,
    },

    data: {
      status: "SCHEDULED",
    },
  });

  // Scheduling a quiz schedules the BullMQ job that will initialize the
  // runtime and start it automatically at
  // (scheduledStartTime - LOBBY_DURATION_MS).
  await scheduleQuizStart(
    id,
    updated.scheduledStartTime,
    RuntimeConfig.LOBBY_DURATION_MS,
  );

  return updated;
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

  const updated = await prisma.quiz.update({
    where: {
      id,
    },

    data: {
      status: "DRAFT",
    },
  });

  // Moving back to draft deletes both the scheduled start job and any
  // runtime that may have already been initialized for it.
  await cancelQuizStart(id);
  await runtimeManager.destroy(id);

  return updated;
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

  const runtime = await runtimeManager.getRuntimeSnapshot(quiz.id);

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

/**
 * Paginated quiz history for the current student — one row per COMPLETED
 * quiz they submitted at least one answer to. Ordered by most recently
 * completed first.
 *
 * Intentionally returns ONLY summary/result data (title, date, rank,
 * participants, score, question count) — never question or answer content,
 * since students should not be able to review question banks via history.
 */
async function getMyHistory(user, { page = 1, limit = 10 } = {}) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 50) : 10;
  const skip = (safePage - 1) * safeLimit;

  const where = {
    status: "COMPLETED",
    submissions: {
      some: { userId: user.id },
    },
  };

  const [total, quizzes] = await Promise.all([
    prisma.quiz.count({ where }),
    prisma.quiz.findMany({
      where,
      orderBy: { completedAt: "desc" },
      skip,
      take: safeLimit,
      select: {
        id: true,
        title: true,
        completedAt: true,
        scheduledStartTime: true,
        _count: { select: { quizQuestions: true } },
      },
    }),
  ]);

  const results = await Promise.all(
    quizzes.map(async (quiz) => {
      // All submissions for this quiz — only userId + score are needed to
      // compute the totals leaderboard, never question/answer content.
      const submissions = await prisma.quizSubmission.findMany({
        where: { quizId: quiz.id },
        select: { userId: true, score: true },
      });

      const totalsByUser = new Map();
      for (const sub of submissions) {
        totalsByUser.set(
          sub.userId,
          (totalsByUser.get(sub.userId) ?? 0) + sub.score,
        );
      }

      const ranked = Array.from(totalsByUser.entries())
        .map(([userId, score]) => ({ userId, score }))
        .sort((a, b) => b.score - a.score);

      const myIndex = ranked.findIndex((r) => r.userId === user.id);

      return {
        quizId: quiz.id,
        title: quiz.title,
        completedAt: quiz.completedAt ?? quiz.scheduledStartTime,
        rank: myIndex === -1 ? null : myIndex + 1,
        totalParticipants: ranked.length,
        score: myIndex === -1 ? 0 : ranked[myIndex].score,
        totalQuestions: quiz._count.quizQuestions,
      };
    }),
  );

  return {
    results,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: skip + quizzes.length < total,
    },
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
  getMyHistory,
};
