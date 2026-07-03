/**
 * Objective quality Q — the genre-weighted sum of the six axis scores
 * (GOING_GOLD_GDD.md §7.3). Q is what the game *deserves*; the context
 * modifiers in §7.6 will distort what it *gets*.
 */

import { QUALITY_AXES, type AxisScores, type GenreWeights } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Q = Σ (AxisScore_i × GenreWeight_i), normalized to 0–100.
 * Weights don't need to sum to 1 — they are normalized here.
 */
export function computeQuality(axes: AxisScores, weights: GenreWeights): number {
  const totalWeight = QUALITY_AXES.reduce((sum, axis) => sum + weights[axis], 0);
  if (totalWeight <= 0) {
    throw new Error("Genre weights must have a positive sum");
  }
  const weightedSum = QUALITY_AXES.reduce(
    (sum, axis) => sum + clamp(axes[axis], 0, 100) * weights[axis],
    0,
  );
  return clamp(weightedSum / totalWeight, 0, 100);
}
