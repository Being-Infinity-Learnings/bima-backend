// Analytics service — aggregates quiz submission data for the dashboard.
// All queries are read-only and scoped to COMPLETED quizzes.

const prisma = require("../../config/prisma");

/**
 * Returns a list of all completed quizzes with summary stats:
 * - participant count
 * - total questions
 * - average score
 * - completion date
 */
async function getCompletedQuizzes() {
  const quizzes = await prisma.quiz.findMany({
    where: { status: "COMPLETED" },
    include: {
      _count: { select: { quizQuestions: true } },
      submissions: {
        select: { userId: true, score: true },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  return quizzes.map((q) => {
    const uniqueParticipants = new Set(q.submissions.map((s) => s.userId)).size;
    const totalScore = q.submissions.reduce((sum, s) => sum + s.score, 0);
    const avgScore =
      q.submissions.length > 0
        ? Math.round(totalScore / q.submissions.length)
        : 0;

    return {
      id: q.id,
      title: q.title,
      description: q.description,
      coverImageUrl: q.coverImageUrl,
      scheduledStartTime: q.scheduledStartTime,
      actualStartTime: q.actualStartTime,
      completedAt: q.completedAt,
      totalQuestions: q._count.quizQuestions,
      participantCount: uniqueParticipants,
      avgScore,
      totalSubmissions: q.submissions.length,
    };
  });
}

/**
 * Returns full analytics for a single completed quiz:
 * - Quiz metadata
 * - Ordered list of questions with per-option answer breakdown
 * - Leaderboard (top scorers with rank, user info, score, time)
 * - Per-participant answer trail
 */
async function getQuizAnalytics(quizId) {
  // 1. Load quiz with questions in order
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      quizQuestions: {
        orderBy: { orderIndex: "asc" },
        include: {
          question: {
            include: {
              options: { orderBy: { orderIndex: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!quiz) throw new Error("Quiz not found");

  // 2. Load all submissions for this quiz with user info
  const submissions = await prisma.quizSubmission.findMany({
    where: { quizId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          rollNumber: true,
          collegeName: true,
        },
      },
    },
    orderBy: { submittedAt: "asc" },
  });

  // 3. Build a map: userId → { user, answers: { questionId → submission } }
  const participantMap = {};
  for (const sub of submissions) {
    if (!participantMap[sub.userId]) {
      participantMap[sub.userId] = {
        user: sub.user,
        answers: {},
        totalScore: 0,
        totalElapsedMs: 0,
        answeredCount: 0,
      };
    }
    participantMap[sub.userId].answers[sub.questionId] = sub;
    participantMap[sub.userId].totalScore += sub.score;
    participantMap[sub.userId].totalElapsedMs += sub.elapsedMs;
    participantMap[sub.userId].answeredCount += 1;
  }

  const uniqueParticipants = Object.values(participantMap);

  // 4. Build leaderboard: sort by totalScore desc, then totalElapsedMs asc
  const leaderboard = uniqueParticipants
    .map((p) => ({
      userId: p.user.id,
      fullName: p.user.fullName,
      email: p.user.email,
      rollNumber: p.user.rollNumber,
      collegeName: p.user.collegeName,
      totalScore: p.totalScore,
      totalElapsedMs: p.totalElapsedMs,
      answeredCount: p.answeredCount,
      correctCount: Object.values(p.answers).filter((a) => a.correct).length,
    }))
    .sort((a, b) =>
      b.totalScore !== a.totalScore
        ? b.totalScore - a.totalScore
        : a.totalElapsedMs - b.totalElapsedMs,
    )
    .map((p, i) => ({ ...p, rank: i + 1 }));

  // 5. Build per-question breakdown
  const questions = quiz.quizQuestions.map(({ question, orderIndex }) => {
    // Submissions for this question
    const qSubmissions = submissions.filter(
      (s) => s.questionId === question.id,
    );

    // Count how many times each option was selected
    const optionCounts = {};
    for (const opt of question.options) optionCounts[opt.id] = 0;

    for (const sub of qSubmissions) {
      for (const optId of sub.selectedOptionIds) {
        if (optionCounts[optId] !== undefined) optionCounts[optId]++;
      }
    }

    const correctCount = qSubmissions.filter((s) => s.correct).length;
    const totalAnswered = qSubmissions.length;

    return {
      orderIndex,
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      mediaUrl: question.mediaUrl,
      customTimer: question.customTimer,
      totalAnswered,
      correctCount,
      incorrectCount: totalAnswered - correctCount,
      accuracyPct:
        totalAnswered > 0
          ? Math.round((correctCount / totalAnswered) * 100)
          : 0,
      avgElapsedMs:
        totalAnswered > 0
          ? Math.round(
              qSubmissions.reduce((s, x) => s + x.elapsedMs, 0) / totalAnswered,
            )
          : 0,
      options: question.options.map((opt) => ({
        id: opt.id,
        optionText: opt.optionText,
        isCorrect: opt.isCorrect,
        selectedCount: optionCounts[opt.id] ?? 0,
        selectedPct:
          totalAnswered > 0
            ? Math.round(((optionCounts[opt.id] ?? 0) / totalAnswered) * 100)
            : 0,
      })),
    };
  });

  // 6. Build per-participant answer trail (for the detailed breakdown table)
  const participantTrail = leaderboard.map((p) => {
    const pData = participantMap[p.userId];
    const trail = questions.map((q) => {
      const ans = pData.answers[q.questionId];
      return {
        questionId: q.questionId,
        orderIndex: q.orderIndex,
        selectedOptionIds: ans?.selectedOptionIds ?? [],
        correct: ans?.correct ?? null,
        score: ans?.score ?? 0,
        elapsedMs: ans?.elapsedMs ?? null,
        answered: !!ans,
      };
    });
    return {
      userId: p.userId,
      fullName: p.fullName,
      email: p.email,
      rollNumber: p.rollNumber,
      collegeName: p.collegeName,
      rank: p.rank,
      totalScore: p.totalScore,
      totalElapsedMs: p.totalElapsedMs,
      correctCount: p.correctCount,
      answeredCount: p.answeredCount,
      trail,
    };
  });

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      coverImageUrl: quiz.coverImageUrl,
      status: quiz.status,
      scheduledStartTime: quiz.scheduledStartTime,
      actualStartTime: quiz.actualStartTime,
      completedAt: quiz.completedAt,
      defaultTimer: quiz.defaultTimer,
    },
    summary: {
      participantCount: uniqueParticipants.length,
      totalQuestions: questions.length,
      totalSubmissions: submissions.length,
      avgScore:
        leaderboard.length > 0
          ? Math.round(
              leaderboard.reduce((s, p) => s + p.totalScore, 0) /
                leaderboard.length,
            )
          : 0,
      topScore: leaderboard[0]?.totalScore ?? 0,
    },
    leaderboard,
    questions,
    participantTrail,
  };
}

module.exports = { getCompletedQuizzes, getQuizAnalytics };
