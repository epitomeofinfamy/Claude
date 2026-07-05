import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TUNING,
  DIFFICULTY_PRESETS,
  applyDifficulty,
  getDifficulty,
  getTuning,
  resetTuning,
  setTuning,
  type TuningConfig,
} from "./config";
import { expectationMod, reviewCritics, type ReviewInputs } from "./reviews";
import { scopeFactor } from "./production";
import { quarterlyBurn } from "./economy";
import { advanceMarketQuarter, createMarketSim } from "./market";
import { updateStaffMeters } from "./milestones";
import { OUTLETS } from "./data/outlets";
import type { Staff } from "./types";

afterEach(resetTuning);

const staffer: Staff = {
  id: "s",
  name: "s",
  specialty: "designer",
  skills: { designer: 60, programmer: 20, artist: 20, audio: 20, writer: 20, producer: 20, qa: 20 },
  morale: 60,
  burnout: 40,
};

const reviewInputs: ReviewInputs = {
  axes: { gameplay: 75, content: 75, presentation: 75, narrative: 75, innovation: 75, polish: 75 },
  q: 75,
  expectation: { marketingHype: 90, scopeTier: "aaa", reputation: 80, sequelPedigree: 60 },
  context: {
    genreTrend: "neutral",
    topicTrend: "neutral",
    windowCrowding: "normal",
    platformFit: 1,
    isSequel: false,
  },
};

describe("the config module", () => {
  it("starts at the defaults and resets cleanly", () => {
    expect(getTuning()).toEqual(DEFAULT_TUNING);
    setTuning({ expectationKDown: 0.3, burnRate: 2 });
    expect(getTuning().expectationKDown).toBe(0.3);
    resetTuning();
    expect(getTuning()).toEqual(DEFAULT_TUNING);
    expect(getDifficulty()).toBe("standard");
  });

  it("live-tunes ExpectationMod: k and scale change the next computation", () => {
    const before = expectationMod(-15);
    setTuning({ expectationKDown: 0.3 });
    expect(expectationMod(-15)).toBeLessThan(before); // harsher punishment
    setTuning({ expectationKDown: DEFAULT_TUNING.expectationKDown, expectationScale: 90 });
    expect(expectationMod(-15)).toBeGreaterThan(before); // gentler curve
  });

  it("live-tunes the outlet variance bounds", () => {
    const wild = () => 1; // always the luckiest roll
    setTuning({ outletVarianceScale: 0 });
    const flat = reviewCritics(reviewInputs, OUTLETS, wild);
    setTuning({ outletVarianceScale: 2 });
    const noisy = reviewCritics(reviewInputs, OUTLETS, wild);
    expect(noisy.reviews[0]!.score - flat.reviews[0]!.score).toBeCloseTo(
      OUTLETS[0]!.variance * 2,
    );
  });

  it("live-tunes the overscope penalty steepness", () => {
    const before = scopeFactor(100);
    setTuning({ overscopeSteepness: 0.6 });
    expect(scopeFactor(100)).toBeCloseTo(0.4);
    expect(scopeFactor(100)).toBeLessThan(before);
  });

  it("live-tunes trend cycle speed and market volatility", () => {
    // Volatility 0 + neutral pull: momentum moves only by mean reversion.
    setTuning({ marketVolatility: 0, trendCycleSpeed: 1 });
    const calm = advanceMarketQuarter(createMarketSim(), () => 0.99).sim;
    setTuning({ marketVolatility: 3 });
    const wild = advanceMarketQuarter(createMarketSim(), () => 0.99).sim;
    expect(wild.genreHype.puzzle.momentum).toBeGreaterThan(calm.genreHype.puzzle.momentum);

    // Faster cycles: a level far from 50 reverts harder.
    setTuning({ marketVolatility: 0, trendCycleSpeed: 3 });
    const fast = advanceMarketQuarter(createMarketSim(), () => 0.5).sim;
    setTuning({ marketVolatility: 0, trendCycleSpeed: 1 });
    const slow = advanceMarketQuarter(createMarketSim(), () => 0.5).sim;
    // adventure starts at level 62: stronger pull drags momentum down faster.
    expect(fast.genreHype.adventure.momentum).toBeLessThan(slow.genreHype.adventure.momentum);
  });

  it("live-tunes the economy burn and the morale rates", () => {
    const base = quarterlyBurn([staffer]);
    setTuning({ burnRate: 1.5 });
    expect(quarterlyBurn([staffer])).toBe(Math.round(base * 1.5));

    setTuning({ crunchToll: 2 });
    const doubled = updateStaffMeters(staffer, true);
    resetTuning();
    const normal = updateStaffMeters(staffer, true);
    expect(doubled.burnout - staffer.burnout).toBeCloseTo(
      (normal.burnout - staffer.burnout) * 2,
    );

    setTuning({ recoveryRate: 2 });
    const fastRest = updateStaffMeters(staffer, false);
    resetTuning();
    const normalRest = updateStaffMeters(staffer, false);
    expect(staffer.burnout - fastRest.burnout).toBeCloseTo(
      (staffer.burnout - normalRest.burnout) * 2,
    );
  });
});

describe("difficulty tiers (§12)", () => {
  it("touch only expectation steepness, market volatility, and the cash cushion", () => {
    const allowed: (keyof TuningConfig)[] = [
      "expectationKDown",
      "expectationScale",
      "marketVolatility",
      "burnRate",
      "startingCash",
    ];
    for (const preset of Object.values(DIFFICULTY_PRESETS)) {
      for (const key of Object.keys(preset)) {
        expect(allowed).toContain(key); // never inflated stats (§12)
      }
    }
  });

  it("brutal punishes the same hype gap harder than cozy", () => {
    applyDifficulty("cozy");
    const cozy = reviewCritics(reviewInputs, OUTLETS, () => 0.5);
    applyDifficulty("brutal");
    const brutal = reviewCritics(reviewInputs, OUTLETS, () => 0.5);
    // Same over-hyped game (Q 75 vs. sky-high expectations), same rolls.
    expect(brutal.metascore).toBeLessThan(cozy.metascore - 1);
    expect(brutal.expectedQuality).toBe(cozy.expectedQuality); // the bar itself is untouched
  });

  it("sets the cushion and the burn, and switching tiers replaces manual edits", () => {
    applyDifficulty("brutal");
    expect(getTuning().startingCash).toBeLessThan(DEFAULT_TUNING.startingCash);
    expect(getTuning().burnRate).toBeGreaterThan(1);
    setTuning({ overscopeSteepness: 0.7 });
    applyDifficulty("cozy");
    expect(getTuning().overscopeSteepness).toBe(DEFAULT_TUNING.overscopeSteepness);
    expect(getTuning().startingCash).toBeGreaterThan(DEFAULT_TUNING.startingCash);
    expect(getDifficulty()).toBe("cozy");
  });
});
