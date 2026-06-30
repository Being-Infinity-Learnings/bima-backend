function calculateScore({ elapsedMs, durationMs, maxScore }) {
  const remainingMs = Math.max(durationMs - elapsedMs, 0);

  const remainingPercentage = remainingMs / durationMs;

  return Math.round(maxScore * remainingPercentage);
}

module.exports = calculateScore;
