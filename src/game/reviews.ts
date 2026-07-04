/**
 * The critic review pipeline — GDD §7.4–§7.8 (order of operations: §15).
 *
 * Given what the game *is* (axes, Q) and the context it launches into
 * (expectations, trends, timing, platform, sequel status, reputation), this
 * module computes what the game *gets*: per-outlet scores, the
 * prestige-weighted Metascore with consensus tightness, and the separately
 * modeled user score.
 *
 *   OutletScore = OutletRaw × ExpectationMod × TrendMod × TimingMod
 *                 × PlatformFitMod × SequelMod × ReputationHalo
 *                 + Variance(outlet)                                (§7.5)
 *
 * Everything is pure; randomness (outlet variance) comes from an injected
 * RNG so tests and replays stay deterministic.
 *
 * One documented interpretation of §7.5: OutletRaw blends the outlet's
 * personality read (its axis-weighted sum) with the game's objective Q,
 * controlled by OUTLET_PERSONALITY_WEIGHT. At weight 1 this is the literal
 * §7.5 formula; the default 0.35 keeps outlets opinionated while calibrating
 * the pipeline to the §7.12 worked example (critics agree on the big
 * picture, diverge at the margins — the ±variance supplies the 9-vs-6 drama).
 */

import {
  QUALITY_AXES,
  type AxisScores,
  type Outlet,
  type ScopeTier,
  type TrendPhase,
} from "./types";
import { clamp } from "./quality";

/** Uniform [0, 1) random source, injected by the caller. */
export type Rng = () => number;

export type WindowCrowding = "clear" | "normal" | "crowded";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/**
 * Review tuning. Three of the four first-order dials from §15 live here:
 * `k` (split into EXPECTATION_K_UP / EXPECTATION_K_DOWN — the split IS the
 * asymmetry of hype punishment), `scale` (EXPECTATION_SCALE), and the outlet
 * variance bound multiplier (VARIANCE_SCALE). The fourth, overscope penalty
 * steepness, is PRODUCTION_TUNING.OVERSCOPE_STEEPNESS in production.ts.
 */
export const REVIEW_TUNING = {
  // --- ExpectationMod (§7.6, the marquee mechanic) ---
  /** Max fractional reward for overdelivering on expectations. */
  EXPECTATION_K_UP: 0.06,
  /** Max fractional punishment for falling short — deliberately > K_UP. */
  EXPECTATION_K_DOWN: 0.14,
  /** Gap (in Q points) at which the tanh curve approaches saturation. */
  EXPECTATION_SCALE: 30,

  // --- ExpectedQuality inputs (§7.6) ---
  EXPECTED_BASELINE: 30,
  EXPECTED_FROM_HYPE: 0.2,
  EXPECTED_FROM_REPUTATION: 0.18,
  EXPECTED_FROM_PEDIGREE: 0.12,
  EXPECTED_TIER_BUMP: { prototype: 0, indie: 5, "double-a": 12, aaa: 18 } as Record<
    ScopeTier,
    number
  >,

  // --- Other §7.6 context modifiers ---
  TREND_MOD: { rising: 1.04, neutral: 1, fatigued: 0.94 } as Record<TrendPhase, number>,
  TIMING_MOD: { clear: 1.01, normal: 1, crowded: 0.985 } as Record<WindowCrowding, number>,
  SEQUEL_PEDIGREE_BUMP: 0.03,
  /** Innovation level a sequel must clear to dodge iteration fatigue. */
  SEQUEL_INNOVATION_PAR: 65,
  SEQUEL_FATIGUE_SPAN: 0.25,
  SEQUEL_MOD_MIN: 0.9,
  SEQUEL_MOD_MAX: 1.08,
  /** Halo span across the 0–100 reputation range, centered at 50. */
  REPUTATION_HALO_SPAN: 0.08,

  // --- Outlet scoring (§7.4–§7.5) ---
  /** 0 = every outlet just reports Q; 1 = the literal §7.5 weighted sum. */
  OUTLET_PERSONALITY_WEIGHT: 0.35,
  /** Additive score shift across the harshness range (lenient − harsh). */
  HARSHNESS_POINTS: 6,
  /** Global multiplier on each outlet's variance bound (±points). */
  VARIANCE_SCALE: 1,

  // --- Metascore (§7.7) ---
  /** Prestige-weighted score stddev at which consensus reads as 0. */
  CONSENSUS_STDEV_MAX: 12,
} as const;

/** User score tuning (§7.8): users over-index Value and launch Polish. */
export const USER_SCORE_TUNING = {
  WEIGHT_VALUE: 0.3,
  WEIGHT_LAUNCH_POLISH: 0.4,
  WEIGHT_QUALITY: 0.3,
  /** Fractional value swing across the 0–100 price range (50 = standard). */
  PRICE_VALUE_SPAN: 0.4,
  /** Max points lost to hype backlash — stronger than the critic-side mod. */
  BACKLASH_POINTS: 18,
  /** Max points gained from underdog overdelivery (smaller, asymmetric). */
  DELIGHT_POINTS: 6,
  BACKLASH_SCALE: 15,
  /** Below this launch Polish, users get *angry* (nonlinear bug rage). */
  BUG_RAGE_THRESHOLD: 70,
  BUG_RAGE_POINTS: 10,
  BUG_RAGE_SCALE: 15,
  /** Max points swing from community sentiment (0–100, 50 = neutral). */
  SENTIMENT_POINTS: 6,
} as const;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** What sets the bar before anyone plays (§7.6). */
export interface ExpectationInputs {
  /** Normalized marketing push, 0–100. */
  marketingHype: number;
  scopeTier: ScopeTier;
  /** Studio reputation, 0–100. */
  reputation: number;
  /** Franchise pedigree, 0–100; 0 for a new IP. */
  sequelPedigree: number;
}

/** The market/timing context the game launches into (§7.6). */
export interface ReviewContext {
  genreTrend: TrendPhase;
  topicTrend: TrendPhase;
  windowCrowding: WindowCrowding;
  /** Platform fit multiplier (1 = neutral), e.g. from PLATFORM_CATALOG genreFit. */
  platformFit: number;
  isSequel: boolean;
}

export interface ReviewInputs {
  axes: AxisScores;
  /** Objective quality from production (§7.3). */
  q: number;
  expectation: ExpectationInputs;
  context: ReviewContext;
}

export interface OutletReview {
  outletId: string;
  outletName: string;
  score: number;
}

export interface CriticReception {
  expectedQuality: number;
  /** q − expectedQuality: the number the whole campaign teaches you to manage. */
  gap: number;
  reviews: OutletReview[];
  metascore: number;
  /** 0–1: 1 = unanimous press, 0 = wildly divisive (§7.7). */
  consensus: number;
}

export interface UserScoreInputs {
  axes: AxisScores;
  q: number;
  /** q − expectedQuality; negative gaps trigger hype backlash (§7.8). */
  gap: number;
  /** Price positioning 0–100 (50 = standard; higher = pricier). */
  price: number;
  /** Community goodwill/controversy 0–100 (50 = neutral). */
  sentiment: number;
}

// ---------------------------------------------------------------------------
// Step 1 — ExpectedQuality (§7.6)
// ---------------------------------------------------------------------------

export function computeExpectedQuality(inputs: ExpectationInputs): number {
  const t = REVIEW_TUNING;
  return clamp(
    t.EXPECTED_BASELINE +
      t.EXPECTED_FROM_HYPE * clamp(inputs.marketingHype, 0, 100) +
      t.EXPECTED_TIER_BUMP[inputs.scopeTier] +
      t.EXPECTED_FROM_REPUTATION * clamp(inputs.reputation, 0, 100) +
      t.EXPECTED_FROM_PEDIGREE * clamp(inputs.sequelPedigree, 0, 100),
    0,
    100,
  );
}

// ---------------------------------------------------------------------------
// Step 3 — the §7.6 context modifiers, each exported for tests and tuning
// ---------------------------------------------------------------------------

/**
 * The asymmetric tanh at the heart of ExpectationMod: falling short of hype
 * is punished harder (K_DOWN) than overachieving is rewarded (K_UP).
 * Returns a signed fraction; ExpectationMod = 1 + asymTanh(gap).
 */
export function asymTanh(gap: number): number {
  const { EXPECTATION_K_UP, EXPECTATION_K_DOWN, EXPECTATION_SCALE } = REVIEW_TUNING;
  return gap >= 0
    ? EXPECTATION_K_UP * Math.tanh(gap / EXPECTATION_SCALE)
    : -EXPECTATION_K_DOWN * Math.tanh(-gap / EXPECTATION_SCALE);
}

export function expectationMod(gap: number): number {
  return 1 + asymTanh(gap);
}

export function trendMod(phase: TrendPhase): number {
  return REVIEW_TUNING.TREND_MOD[phase];
}

export function timingMod(crowding: WindowCrowding): number {
  return REVIEW_TUNING.TIMING_MOD[crowding];
}

/**
 * SequelMod: pedigree bump vs. iteration fatigue (§7.6). A sequel that
 * meaningfully evolves (Innovation above par) is rewarded; a lazy iteration
 * is penalized. Non-sequels are untouched.
 */
export function sequelMod(
  isSequel: boolean,
  innovationAxis: number,
  pedigree: number,
): number {
  if (!isSequel) return 1;
  const t = REVIEW_TUNING;
  const mod =
    1 +
    t.SEQUEL_PEDIGREE_BUMP * (clamp(pedigree, 0, 100) / 100) +
    t.SEQUEL_FATIGUE_SPAN *
      ((clamp(innovationAxis, 0, 100) - t.SEQUEL_INNOVATION_PAR) / 100);
  return clamp(mod, t.SEQUEL_MOD_MIN, t.SEQUEL_MOD_MAX);
}

/** ReputationHalo: benefit of the doubt for the established, skepticism for unknowns. */
export function reputationHalo(reputation: number): number {
  return 1 + REVIEW_TUNING.REPUTATION_HALO_SPAN * ((clamp(reputation, 0, 100) - 50) / 100);
}

// ---------------------------------------------------------------------------
// Step 2 + 4 — outlet scores and the Metascore (§7.4, §7.5, §7.7)
// ---------------------------------------------------------------------------

/** The outlet's personality read: its normalized axis-weighted sum (§7.5). */
export function outletPersonalityScore(axes: AxisScores, outlet: Outlet): number {
  const totalWeight = QUALITY_AXES.reduce((s, a) => s + outlet.axisWeights[a], 0);
  if (totalWeight <= 0) return 0;
  const weighted = QUALITY_AXES.reduce(
    (s, a) => s + clamp(axes[a], 0, 100) * outlet.axisWeights[a],
    0,
  );
  return weighted / totalWeight;
}

/** Runs the full §7.5 chain for the whole outlet roster and aggregates §7.7. */
export function reviewCritics(
  inputs: ReviewInputs,
  outlets: Outlet[],
  rng: Rng,
): CriticReception {
  if (outlets.length === 0) {
    throw new Error("reviewCritics needs at least one outlet");
  }
  const t = REVIEW_TUNING;
  const expectedQuality = computeExpectedQuality(inputs.expectation);
  const gap = inputs.q - expectedQuality;

  const contextMod =
    expectationMod(gap) *
    trendMod(inputs.context.genreTrend) *
    trendMod(inputs.context.topicTrend) *
    timingMod(inputs.context.windowCrowding) *
    inputs.context.platformFit *
    sequelMod(
      inputs.context.isSequel,
      inputs.axes.innovation,
      inputs.expectation.sequelPedigree,
    ) *
    reputationHalo(inputs.expectation.reputation);

  const reviews: OutletReview[] = outlets.map((outlet) => {
    const personality = outletPersonalityScore(inputs.axes, outlet);
    const raw =
      (1 - t.OUTLET_PERSONALITY_WEIGHT) * clamp(inputs.q, 0, 100) +
      t.OUTLET_PERSONALITY_WEIGHT * personality;
    const harshnessAdj = (0.5 - outlet.harshness) * t.HARSHNESS_POINTS;
    const noise = (2 * rng() - 1) * outlet.variance * t.VARIANCE_SCALE;
    return {
      outletId: outlet.id,
      outletName: outlet.name,
      score: clamp(raw * contextMod + harshnessAdj + noise, 0, 100),
    };
  });

  // Metascore: prestige-weighted mean (§7.7).
  const totalPrestige = outlets.reduce((s, o) => s + o.prestige, 0);
  const metascore =
    reviews.reduce((s, r, i) => s + r.score * outlets[i]!.prestige, 0) / totalPrestige;

  // Consensus tightness: prestige-weighted spread mapped to 0–1 (§7.7).
  const variance =
    reviews.reduce(
      (s, r, i) => s + outlets[i]!.prestige * (r.score - metascore) ** 2,
      0,
    ) / totalPrestige;
  const consensus = clamp(1 - Math.sqrt(variance) / t.CONSENSUS_STDEV_MAX, 0, 1);

  return { expectedQuality, gap, reviews, metascore, consensus };
}

// ---------------------------------------------------------------------------
// Step 5 — the user score, a separate model (§7.8)
// ---------------------------------------------------------------------------

/**
 * Users weight Value (Content vs. price) and launch Polish far more than
 * critics do, rage nonlinearly at launch bugs, and punish over-marketing
 * with backlash — producing the two classic critic/user divergences (§7.8).
 * Deterministic by design; sentiment carries any mood the sim wants to add.
 */
export function computeUserScore(inputs: UserScoreInputs): number {
  const t = USER_SCORE_TUNING;

  // Value: content relative to price (50 = standard pricing).
  const priceFactor = 1 + t.PRICE_VALUE_SPAN * ((50 - clamp(inputs.price, 0, 100)) / 100);
  const value = clamp(clamp(inputs.axes.content, 0, 100) * priceFactor, 0, 100);
  const launchPolish = clamp(inputs.axes.polish, 0, 100);

  const base =
    t.WEIGHT_VALUE * value +
    t.WEIGHT_LAUNCH_POLISH * launchPolish +
    t.WEIGHT_QUALITY * clamp(inputs.q, 0, 100);

  // Hype backlash / underdog delight — asymmetric, like the critics but angrier.
  const hypeAdj =
    inputs.gap >= 0
      ? t.DELIGHT_POINTS * Math.tanh(inputs.gap / t.BACKLASH_SCALE)
      : -t.BACKLASH_POINTS * Math.tanh(-inputs.gap / t.BACKLASH_SCALE);

  // Bug rage: below the threshold, launch-day bugs enrage users nonlinearly.
  const bugRage =
    launchPolish < t.BUG_RAGE_THRESHOLD
      ? -t.BUG_RAGE_POINTS *
        Math.tanh((t.BUG_RAGE_THRESHOLD - launchPolish) / t.BUG_RAGE_SCALE)
      : 0;

  const sentimentAdj =
    t.SENTIMENT_POINTS * ((clamp(inputs.sentiment, 0, 100) - 50) / 50);

  return clamp(base + hypeAdj + bugRage + sentimentAdj, 0, 100);
}
