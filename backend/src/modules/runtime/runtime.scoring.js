// Purpose: Compute a score for a question based on how quickly the user
// answered relative to the question duration.
function calculateScore({ elapsedMs, durationMs, maxScore }) {
  // Guard against a zero or missing duration (e.g. customTimer was saved as
  // 0 in the DB) — award full marks rather than producing NaN.
  if (!durationMs) return maxScore;

  const remainingMs = Math.max(durationMs - elapsedMs, 0);

  const remainingPercentage = remainingMs / durationMs;

  return Math.round(maxScore * remainingPercentage);
}

module.exports = calculateScore;
