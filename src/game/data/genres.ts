/**
 * Genre ideal-axis profiles — the GDD §4 table encoded as per-axis weights.
 * "Emphasizes" and "De-emphasizes" map to fixed weight levels; unlisted axes
 * are neutral. Weights are relative (normalized when computing Q, §7.3).
 */

import type { Genre, GenreWeights } from "../types";

export const EMPHASIZED = 2;
export const NEUTRAL = 1;
export const DEEMPHASIZED = 0.5;

export const GENRE_PROFILES: Record<Genre, GenreWeights> = {
  // RPG: emphasizes Content, Narrative; de-emphasizes nothing.
  rpg: {
    gameplay: NEUTRAL,
    content: EMPHASIZED,
    presentation: NEUTRAL,
    narrative: EMPHASIZED,
    innovation: NEUTRAL,
    polish: NEUTRAL,
  },
  // Shooter: emphasizes Gameplay, Presentation, Polish; de-emphasizes Narrative.
  shooter: {
    gameplay: EMPHASIZED,
    content: NEUTRAL,
    presentation: EMPHASIZED,
    narrative: DEEMPHASIZED,
    innovation: NEUTRAL,
    polish: EMPHASIZED,
  },
  // Puzzle: emphasizes Gameplay, Innovation; de-emphasizes Content, Presentation.
  puzzle: {
    gameplay: EMPHASIZED,
    content: DEEMPHASIZED,
    presentation: DEEMPHASIZED,
    narrative: NEUTRAL,
    innovation: EMPHASIZED,
    polish: NEUTRAL,
  },
  // Strategy: emphasizes Gameplay, Content; de-emphasizes Presentation.
  strategy: {
    gameplay: EMPHASIZED,
    content: EMPHASIZED,
    presentation: DEEMPHASIZED,
    narrative: NEUTRAL,
    innovation: NEUTRAL,
    polish: NEUTRAL,
  },
  // Adventure: emphasizes Narrative, Presentation; de-emphasizes Gameplay.
  adventure: {
    gameplay: DEEMPHASIZED,
    content: NEUTRAL,
    presentation: EMPHASIZED,
    narrative: EMPHASIZED,
    innovation: NEUTRAL,
    polish: NEUTRAL,
  },
  // Simulation: emphasizes Gameplay, Content, Polish; de-emphasizes Narrative.
  simulation: {
    gameplay: EMPHASIZED,
    content: EMPHASIZED,
    presentation: NEUTRAL,
    narrative: DEEMPHASIZED,
    innovation: NEUTRAL,
    polish: EMPHASIZED,
  },
};
