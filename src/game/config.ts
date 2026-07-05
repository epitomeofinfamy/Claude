/**
 * The tuning config — the §15 first-order dials gathered in one place,
 * plus the §12 difficulty tiers.
 *
 * §15 names four knobs to expose first: `k` and `scale` in ExpectationMod
 * (k is split into up/down — the split IS the asymmetry of hype
 * punishment), the outlet variance bounds, trend cycle speed, and the
 * overscope penalty steepness. This module owns those values; economy and
 * morale rates ride along as multipliers on their modules' base constants.
 *
 * Game modules read the active config via getTuning() at computation time,
 * so a change applies to the next computation — functions stay
 * deterministic for a given (inputs, config). setTuning/applyDifficulty
 * mutate between computations (the dev panel, difficulty selection);
 * subscribeTuning/tuningVersion let the UI re-render live.
 *
 * §12: difficulty tiers primarily tune expectation steepness, market
 * volatility, and the cash cushion — never inflated stats. The presets
 * below touch only those dials.
 */

export interface TuningConfig {
  // --- §7.6 ExpectationMod (§15: `k` and `scale`) ---
  /** Max fractional reward for overdelivering on expectations. */
  expectationKUp: number;
  /** Max fractional punishment for falling short — the asymmetry. */
  expectationKDown: number;
  /** Gap (in Q points) at which the tanh curve approaches saturation. */
  expectationScale: number;

  // --- §7.5 outlet variance bounds (§15) ---
  /** Global multiplier on each outlet's ± variance bound. */
  outletVarianceScale: number;

  // --- §7.3 overscope penalty (§15) ---
  overscopeSteepness: number;

  // --- §8 market (§15: trend cycle speed; §12: volatility) ---
  /** Multiplier on the hype curves' mean-reversion pull (cycle speed). */
  trendCycleSpeed: number;
  /** Multiplier on the hype curves' random jitter. */
  marketVolatility: number;

  // --- §9 economy rates ---
  /** Multiplier on quarterly payroll + overhead. */
  burnRate: number;
  /** Cash the studio starts (and restarts) with — the §12 cushion. */
  startingCash: number;

  // --- §5 morale rates ---
  /** Multiplier on crunch's morale cost and burnout gain. */
  crunchToll: number;
  /** Multiplier on rest-time morale/burnout recovery. */
  recoveryRate: number;
}

export const DEFAULT_TUNING: Readonly<TuningConfig> = {
  expectationKUp: 0.06,
  expectationKDown: 0.14,
  expectationScale: 30,
  outletVarianceScale: 1,
  overscopeSteepness: 0.35,
  trendCycleSpeed: 1,
  marketVolatility: 1,
  burnRate: 1,
  startingCash: 65_000,
  crunchToll: 1,
  recoveryRate: 1,
};

// ---------------------------------------------------------------------------
// Difficulty tiers (§12)
// ---------------------------------------------------------------------------

export type Difficulty = "cozy" | "standard" | "brutal";

/**
 * Only the §12 dials move: how hard the expectation curve punishes, how
 * wild the market swings, and how much runway you start with. Axis math,
 * skills, and sales stay untouched at every tier.
 */
export const DIFFICULTY_PRESETS: Record<Difficulty, Partial<TuningConfig>> = {
  cozy: {
    expectationKDown: 0.1,
    expectationScale: 36,
    marketVolatility: 0.7,
    burnRate: 0.85,
    startingCash: 100_000,
  },
  standard: {},
  brutal: {
    expectationKDown: 0.2,
    expectationScale: 24,
    marketVolatility: 1.5,
    burnRate: 1.15,
    startingCash: 40_000,
  },
};

// ---------------------------------------------------------------------------
// The active config
// ---------------------------------------------------------------------------

let active: TuningConfig = { ...DEFAULT_TUNING };
let difficulty: Difficulty = "standard";
let version = 0;
const listeners = new Set<() => void>();

function notify(): void {
  version++;
  for (const listener of listeners) listener();
}

export function getTuning(): Readonly<TuningConfig> {
  return active;
}

export function getDifficulty(): Difficulty {
  return difficulty;
}

/** Adjust individual dials (the dev tuning panel). */
export function setTuning(partial: Partial<TuningConfig>): void {
  active = { ...active, ...partial };
  notify();
}

/** Select a §12 tier: the preset over defaults, dropping manual edits. */
export function applyDifficulty(tier: Difficulty): void {
  difficulty = tier;
  active = { ...DEFAULT_TUNING, ...DIFFICULTY_PRESETS[tier] };
  notify();
}

/** Back to standard defaults (also what tests use to clean up). */
export function resetTuning(): void {
  applyDifficulty("standard");
}

/** Restore a saved dial set wholesale (save/load). */
export function hydrateTuning(config: TuningConfig, tier: Difficulty): void {
  active = { ...config };
  difficulty = tier;
  notify();
}

/** Subscription for UI (useSyncExternalStore-compatible). */
export function subscribeTuning(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function tuningVersion(): number {
  return version;
}
