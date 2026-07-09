// Purpose: Compute a score for a question based on how quickly the user
// answered relative to the question duration.
function calculateScore({ elapsedMs, durationMs, maxScore }) {
  const remainingMs = Math.max(durationMs - elapsedMs, 0);

  const remainingPercentage = remainingMs / durationMs;

  return Math.round(maxScore * remainingPercentage);
}

module.exports = calculateScore;
