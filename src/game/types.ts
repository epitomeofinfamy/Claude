/**
 * Core domain types, following the data-object sketch in GOING_GOLD_GDD.md §15.
 * Everything in src/game/ is pure TypeScript — no React, no DOM, no side effects.
 */

/** The six quality axes every game is scored on (GDD §7.2). */
export const QUALITY_AXES = [
  "gameplay",
  "content",
  "presentation",
  "narrative",
  "innovation",
  "polish",
] as const;

export type QualityAxis = (typeof QUALITY_AXES)[number];

/** A 0–100 reading per axis, produced during production (GDD §7.3). */
export type AxisScores = Record<QualityAxis, number>;

/** Genre weights over the axes; normalized when computing Q (GDD §7.3). */
export type GenreWeights = Record<QualityAxis, number>;
