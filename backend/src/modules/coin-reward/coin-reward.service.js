const prisma = require("../../config/prisma");

// Coin reward formula: coins = min + (scorePercent × (max - min)).
// A user with score 0 (no correct answers or didn't answer) earns nothing;
// a perfect score earns `max` coins; top 3 get +5/+3/+1 bonus when >3 participants, so the absolute
// max a user can earn in a single quiz is coinRewardMax + 5 (1st place bonus).
const TOP_3_BONUS = [5, 3, 1];

function calculateCoins(scorePercent, min, max) {
  return Math.round(min + scorePercent * (max - min));
}

/**
 * Award BECoins to all participants of a completed quiz.
 *
 * Idempotent — checks for existing CoinTransaction records before
 * inserting, so BullMQ retries never double-award.
 *
 * @param {string} quizId
 * @param {Array<{userId: string, totalScore: number, rank: number}>} leaderboard
 * @param {number} maxPossibleScore
 * @returns {{ rewards: Array, totalMinted: number } | null}
 */
async function awardQuizCoins(quizId, leaderboard, maxPossibleScore) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      coinRewardsEnabled: true,
      coinRewardMin: true,
      coinRewardMax: true,
    },
  });

  if (!quiz || !quiz.coinRewardsEnabled) {
    return null;
  }

  const { coinRewardMin, coinRewardMax } = quiz;
  const participantCount = leaderboard.length;

  const rewards = [];

  for (const entry of leaderboard) {
    if (entry.totalScore <= 0) continue;

    const scorePercent =
      maxPossibleScore > 0
        ? Math.min(entry.totalScore / maxPossibleScore, 1)
        : 0;

    const coins = calculateCoins(scorePercent, coinRewardMin, coinRewardMax);

    let bonus = 0;
    if (participantCount > 3 && entry.rank <= 3) {
      bonus = TOP_3_BONUS[entry.rank - 1];
    }

    const totalCoins = coins + bonus;
    if (totalCoins <= 0) continue;

    rewards.push({
      userId: entry.userId,
      coins,
      bonus,
      totalCoins,
      rank: entry.rank,
    });
  }

  if (rewards.length === 0) {
    return { rewards: [], totalMinted: 0 };
  }

  // Check which users already received coins for this quiz (idempotency).
  const existing = await prisma.coinTransaction.findMany({
    where: {
      referenceType: "QUIZ",
      referenceId: quizId,
      type: "QUIZ_REWARD",
    },
    select: { userId: true },
  });

  const alreadyAwarded = new Set(existing.map((e) => e.userId));
  const newRewards = rewards.filter((r) => !alreadyAwarded.has(r.userId));

  if (newRewards.length === 0) {
    return { rewards, totalMinted: 0 };
  }

  await prisma.$transaction(async (tx) => {
    await tx.coinTransaction.createMany({
      data: newRewards.map((r) => ({
        userId: r.userId,
        amount: r.totalCoins,
        type: "QUIZ_REWARD",
        referenceType: "QUIZ",
        referenceId: quizId,
        description:
          r.bonus > 0
            ? `Quiz reward: ${r.coins} + ${r.bonus} bonus (rank #${r.rank})`
            : `Quiz reward: ${r.coins} coins`,
      })),
      skipDuplicates: true,
    });

    for (const r of newRewards) {
      await tx.user.update({
        where: { id: r.userId },
        data: { coinBalance: { increment: r.totalCoins } },
      });
    }
  });

  const totalMinted = newRewards.reduce((sum, r) => sum + r.totalCoins, 0);

  return { rewards, totalMinted };
}

module.exports = { awardQuizCoins, calculateCoins };
