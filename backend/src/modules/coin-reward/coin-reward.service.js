const { Prisma } = require("@prisma/client");
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
 * Award BI Coins to all participants of a completed quiz.
 *
 * Race-safe and idempotent — the unique constraint on CoinTransaction
 * decides who gets paid, so concurrent workers can't double-award.
 *
 * @param {string} quizId
 * @param {Array<{userId: string, totalScore: number, rank: number}>} leaderboard
 * @param {number} maxPossibleScore
 * @returns {{ rewards: Array, balances: Map<string, number> } | null}
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
    return { rewards: [], balances: new Map() };
  }

  // Race-safe: let the unique constraint decide who gets paid.
  // Only users whose ledger row is actually inserted get their balance bumped,
  // so overlapping runs from concurrent workers can't double-pay.
  const balances = await prisma.$transaction(async (tx) => {
    const inserted = await tx.coinTransaction.createManyAndReturn({
      data: rewards.map((r) => ({
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
      select: { userId: true, amount: true },
    });

    if (inserted.length > 0) {
      const values = Prisma.join(
        inserted.map(
          (r) => Prisma.sql`(${r.userId}::text, ${r.amount}::int)`,
        ),
      );
      await tx.$executeRaw`
        UPDATE "User" AS u SET "coinBalance" = u."coinBalance" + v.amount
        FROM (VALUES ${values}) AS v(id, amount)
        WHERE u.id = v.id`;
    }

    return tx.user.findMany({
      where: { id: { in: rewards.map((r) => r.userId) } },
      select: { id: true, coinBalance: true },
    });
  }, { timeout: 15000 });

  const balanceMap = new Map(balances.map((b) => [b.id, b.coinBalance]));

  return { rewards, balances: balanceMap };
}

module.exports = { awardQuizCoins, calculateCoins };
