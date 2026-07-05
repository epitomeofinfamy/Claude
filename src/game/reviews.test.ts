import { describe, expect, it } from "vitest";
import {
  REVIEW_TUNING,
  USER_SCORE_TUNING,
  asymTanh,
  computeExpectedQuality,
  computeUserScore,
  expectationMod,
  outletPersonalityScore,
  reputationHalo,
  reviewCritics,
  sequelMod,
  timingMod,
  trendMod,
  type ReviewInputs,
} from "./reviews";
import { DEFAULT_TUNING } from "./config";
import { OUTLETS } from "./data/outlets";
import type { AxisScores, Outlet } from "./types";

/** rng pinned to 0.5 → zero variance noise; the pipeline becomes deterministic. */
const noNoise = () => 0.5;

const neutralContext = {
  genreTrend: "neutral",
  topicTrend: "neutral",
  windowCrowding: "normal",
  platformFit: 1,
  isSequel: false,
} as const;

function flatAxes(v: number): AxisScores {
  return {
    gameplay: v,
    content: v,
    presentation: v,
    narrative: v,
    innovation: v,
    polish: v,
  };
}

describe("computeExpectedQuality (§7.6)", () => {
  it("rises with hype, budget tier, reputation, and pedigree", () => {
    const base = {
      marketingHype: 30,
      scopeTier: "indie",
      reputation: 30,
      sequelPedigree: 0,
    } as const;
    const e = computeExpectedQuality(base);
    expect(computeExpectedQuality({ ...base, marketingHype: 90 })).toBeGreaterThan(e);
    expect(computeExpectedQuality({ ...base, scopeTier: "aaa" })).toBeGreaterThan(e);
    expect(computeExpectedQuality({ ...base, reputation: 90 })).toBeGreaterThan(e);
    expect(computeExpectedQuality({ ...base, sequelPedigree: 80 })).toBeGreaterThan(e);
  });

  it("reproduces the §7.12 setup: heavy marketing + AAA + rep 70 + pedigree ≈ 84", () => {
    const expected = computeExpectedQuality({
      marketingHype: 80,
      scopeTier: "aaa",
      reputation: 70,
      sequelPedigree: 60,
    });
    expect(expected).toBeGreaterThan(82);
    expect(expected).toBeLessThan(86);
  });
});

describe("ExpectationMod — the asymmetric tanh (§7.6)", () => {
  it("is neutral at gap 0 and monotonic in the gap", () => {
    expect(expectationMod(0)).toBe(1);
    expect(expectationMod(20)).toBeGreaterThan(expectationMod(5));
    expect(expectationMod(-20)).toBeLessThan(expectationMod(-5));
  });

  it("punishes falling short harder than it rewards overachieving", () => {
    for (const gap of [5, 10, 20, 40]) {
      const punishment = 1 - expectationMod(-gap);
      const reward = expectationMod(gap) - 1;
      expect(punishment).toBeGreaterThan(reward);
    }
  });

  it("is bounded by the k dials", () => {
    expect(asymTanh(1000)).toBeLessThanOrEqual(DEFAULT_TUNING.expectationKUp);
    expect(asymTanh(-1000)).toBeGreaterThanOrEqual(-DEFAULT_TUNING.expectationKDown);
  });
});

describe("other §7.6 modifiers", () => {
  it("trend and timing move the right direction", () => {
    expect(trendMod("rising")).toBeGreaterThan(1);
    expect(trendMod("neutral")).toBe(1);
    expect(trendMod("fatigued")).toBeLessThan(1);
    expect(timingMod("clear")).toBeGreaterThan(timingMod("normal"));
    expect(timingMod("crowded")).toBeLessThan(timingMod("normal"));
  });

  it("sequelMod: iteration fatigue for lazy sequels, reward for evolution, no-op for new IP", () => {
    expect(sequelMod(false, 20, 90)).toBe(1);
    // Low innovation + modest pedigree → net penalty (§7.12's case).
    expect(sequelMod(true, 55, 60)).toBeLessThan(1);
    // A sequel that meaningfully evolves is rewarded.
    expect(sequelMod(true, 85, 60)).toBeGreaterThan(1);
    expect(sequelMod(true, 0, 0)).toBeGreaterThanOrEqual(REVIEW_TUNING.SEQUEL_MOD_MIN);
    expect(sequelMod(true, 100, 100)).toBeLessThanOrEqual(REVIEW_TUNING.SEQUEL_MOD_MAX);
  });

  it("reputationHalo gives the established a nudge and unknowns mild skepticism", () => {
    expect(reputationHalo(50)).toBe(1);
    expect(reputationHalo(90)).toBeGreaterThan(1);
    expect(reputationHalo(10)).toBeLessThan(1);
  });
});

describe("the §7.12 worked example, end to end", () => {
  // Mid-size studio (rep 70), heavily-marketed open-world Action-RPG sequel,
  // over-scoped, launched buggy into a crowded holiday window.
  const workedExample: ReviewInputs = {
    axes: {
      gameplay: 80,
      content: 84,
      presentation: 88,
      narrative: 78,
      innovation: 55, // iterative sequel
      polish: 60, // over-scoped, shipped early
    },
    q: 79,
    expectation: {
      marketingHype: 80,
      scopeTier: "aaa",
      reputation: 70,
      sequelPedigree: 60,
    },
    context: {
      genreTrend: "neutral",
      topicTrend: "neutral",
      windowCrowding: "crowded",
      platformFit: 1,
      isSequel: true,
    },
  };

  it("lands the critic Metascore near the GDD's ≈78 — good, but short of the hype", () => {
    const reception = reviewCritics(workedExample, OUTLETS, noNoise);
    expect(reception.gap).toBeGreaterThan(-8);
    expect(reception.gap).toBeLessThan(-2); // mild disappointment
    expect(reception.metascore).toBeGreaterThan(73);
    expect(reception.metascore).toBeLessThan(81);
    // Punished below its objective quality, but still clearly a good game.
    expect(reception.metascore).toBeLessThan(workedExample.q);
    expect(reception.metascore).toBeGreaterThan(70);
    // "Consensus: fairly tight."
    expect(reception.consensus).toBeGreaterThan(0.6);
  });

  it("lands the launch user score near the GDD's ≈62 — bugs and backlash dominate", () => {
    const reception = reviewCritics(workedExample, OUTLETS, noNoise);
    const userScore = computeUserScore({
      axes: workedExample.axes,
      q: workedExample.q,
      gap: reception.gap,
      price: 50,
      sentiment: 50,
    });
    expect(userScore).toBeGreaterThan(57);
    expect(userScore).toBeLessThan(66);
    // The classic §7.8 divergence: users far angrier than critics.
    expect(reception.metascore - userScore).toBeGreaterThan(10);
  });
});

describe("hype strategy (§7.6)", () => {
  const goodGame = {
    axes: { ...flatAxes(78), innovation: 70 },
    q: 79,
  };

  it("an over-hyped good game is punished relative to a modest campaign", () => {
    const hyped = reviewCritics(
      {
        ...goodGame,
        expectation: {
          marketingHype: 95,
          scopeTier: "aaa",
          reputation: 80,
          sequelPedigree: 80,
        },
        context: neutralContext,
      },
      OUTLETS,
      noNoise,
    );
    const modest = reviewCritics(
      {
        ...goodGame,
        expectation: {
          marketingHype: 25,
          scopeTier: "aaa",
          reputation: 80,
          sequelPedigree: 80,
        },
        context: neutralContext,
      },
      OUTLETS,
      noNoise,
    );
    expect(hyped.gap).toBeLessThan(-8);
    expect(hyped.metascore).toBeLessThan(modest.metascore - 2);
    // Marketing was a loan it couldn't repay: scored below its quality.
    expect(hyped.metascore).toBeLessThan(goodGame.q);
  });

  it("a humble overachiever gets the darling bump", () => {
    const strongIndie = { axes: flatAxes(75), q: 75 };
    const humble = reviewCritics(
      {
        ...strongIndie,
        expectation: {
          marketingHype: 5,
          scopeTier: "prototype",
          reputation: 10,
          sequelPedigree: 0,
        },
        context: neutralContext,
      },
      OUTLETS,
      noNoise,
    );
    // Same game, same reputation, but marketed right up to its quality (gap ≈ 0).
    const fullyHyped = reviewCritics(
      {
        ...strongIndie,
        expectation: {
          marketingHype: 90,
          scopeTier: "aaa",
          reputation: 10,
          sequelPedigree: 60,
        },
        context: neutralContext,
      },
      OUTLETS,
      noNoise,
    );
    expect(humble.gap).toBeGreaterThan(20);
    expect(Math.abs(fullyHyped.gap)).toBeLessThan(3);
    expect(humble.metascore).toBeGreaterThan(fullyHyped.metascore + 2);
    expect(expectationMod(humble.gap)).toBeGreaterThan(1);
  });
});

describe("critic/user divergence (§7.8)", () => {
  const expectation = {
    marketingHype: 40,
    scopeTier: "indie",
    reputation: 40,
    sequelPedigree: 0,
  } as const;

  function shipIt(axes: AxisScores, q: number) {
    const reception = reviewCritics(
      { axes, q, expectation, context: neutralContext },
      OUTLETS,
      noNoise,
    );
    const userScore = computeUserScore({
      axes,
      q,
      gap: reception.gap,
      price: 50,
      sentiment: 50,
    });
    return { reception, userScore };
  }

  it("a buggy launch tanks the user score far more than the critics", () => {
    const cleanAxes: AxisScores = {
      gameplay: 78,
      content: 80,
      presentation: 75,
      narrative: 70,
      innovation: 65,
      polish: 85,
    };
    const buggyAxes: AxisScores = { ...cleanAxes, polish: 35 };
    // Q recomputed with polish included (shooter-ish weighting done upstream).
    const clean = shipIt(cleanAxes, 77);
    const buggy = shipIt(buggyAxes, 65);

    const criticDrop = clean.reception.metascore - buggy.reception.metascore;
    const userDrop = clean.userScore - buggy.userScore;
    expect(userDrop).toBeGreaterThan(2 * criticDrop);
    // Critics still see a decent game; users see a broken one.
    expect(buggy.reception.metascore).toBeGreaterThan(60);
    expect(buggy.userScore).toBeLessThan(55);
  });

  it("bug rage is nonlinear: the same polish drop hurts far more below the threshold", () => {
    const base = { axes: flatAxes(75), q: 75, gap: 0, price: 50, sentiment: 50 };
    const at = (polish: number) =>
      computeUserScore({ ...base, axes: { ...base.axes, polish } });
    const dropAbove = at(85) - at(71); // stays above the rage threshold
    const dropBelow = at(69) - at(55); // same 14 points, below it
    expect(dropBelow).toBeGreaterThan(dropAbove * 1.5);
  });

  it("users reward cheap prices and goodwill", () => {
    const base = { axes: flatAxes(70), q: 70, gap: 0, price: 50, sentiment: 50 };
    expect(computeUserScore({ ...base, price: 20 })).toBeGreaterThan(
      computeUserScore({ ...base, price: 80 }),
    );
    expect(computeUserScore({ ...base, sentiment: 90 })).toBeGreaterThan(
      computeUserScore({ ...base, sentiment: 10 }),
    );
    // Sentiment swing is bounded by the dial.
    expect(
      computeUserScore({ ...base, sentiment: 100 }) -
        computeUserScore({ ...base, sentiment: 0 }),
    ).toBeCloseTo(2 * USER_SCORE_TUNING.SENTIMENT_POINTS);
  });
});

describe("outlets, variance, and the Metascore (§7.4, §7.5, §7.7)", () => {
  const plainInputs: ReviewInputs = {
    axes: flatAxes(70),
    q: 70,
    // Chosen so ExpectedQuality ≈ 70 and reputation sits at the halo pivot.
    expectation: {
      marketingHype: 55,
      scopeTier: "double-a",
      reputation: 50,
      sequelPedigree: 65,
    },
    context: neutralContext,
  };

  it("outlet personalities read the same game differently", () => {
    const artGame: AxisScores = {
      gameplay: 50,
      content: 40,
      presentation: 85,
      narrative: 90,
      innovation: 95,
      polish: 25,
    };
    const byId = Object.fromEntries(OUTLETS.map((o) => [o.id, o]));
    expect(outletPersonalityScore(artGame, byId["indie-darling-blog"]!)).toBeGreaterThan(
      outletPersonalityScore(artGame, byId["tech-site"]!) + 15,
    );
  });

  it("a divisive game produces lower consensus than a balanced one", () => {
    const divisive = reviewCritics(
      {
        ...plainInputs,
        axes: {
          gameplay: 50,
          content: 40,
          presentation: 85,
          narrative: 90,
          innovation: 95,
          polish: 25,
        },
      },
      OUTLETS,
      noNoise,
    );
    const balanced = reviewCritics(plainInputs, OUTLETS, noNoise);
    expect(divisive.consensus).toBeLessThan(balanced.consensus);
  });

  it("variance is bounded by each outlet's dial and the global scale", () => {
    const luckiest = reviewCritics(plainInputs, OUTLETS, () => 1);
    const centered = reviewCritics(plainInputs, OUTLETS, noNoise);
    const unluckiest = reviewCritics(plainInputs, OUTLETS, () => 0);
    for (let i = 0; i < OUTLETS.length; i++) {
      const bound = OUTLETS[i]!.variance * DEFAULT_TUNING.outletVarianceScale;
      expect(luckiest.reviews[i]!.score - centered.reviews[i]!.score).toBeCloseTo(bound);
      expect(centered.reviews[i]!.score - unluckiest.reviews[i]!.score).toBeCloseTo(bound);
    }
    // The high-variance outlets are where the surprise scores come from (§7.4).
    expect(Math.max(...OUTLETS.map((o) => o.variance))).toBeGreaterThan(
      Math.min(...OUTLETS.map((o) => o.variance)) * 2,
    );
  });

  it("the Metascore is prestige-weighted, not a plain mean (§7.7)", () => {
    const innovationLover: Outlet = {
      id: "a",
      name: "A",
      axisWeights: {
        gameplay: 0,
        content: 0,
        presentation: 0,
        narrative: 0,
        innovation: 1,
        polish: 0,
      },
      harshness: 0.5,
      prestige: 0.9,
      variance: 1,
    };
    const polishLover: Outlet = {
      ...innovationLover,
      id: "b",
      name: "B",
      axisWeights: { ...innovationLover.axisWeights, innovation: 0, polish: 1 },
      prestige: 0.1,
    };
    const reception = reviewCritics(
      {
        axes: { ...flatAxes(60), innovation: 90, polish: 30 },
        q: 60,
        expectation: {
          marketingHype: 15,
          scopeTier: "aaa",
          reputation: 50,
          sequelPedigree: 0,
        }, // ExpectedQuality = 60 → gap 0, halo neutral
        context: neutralContext,
      },
      [innovationLover, polishLover],
      noNoise,
    );
    const plainMean = (reception.reviews[0]!.score + reception.reviews[1]!.score) / 2;
    // The prestigious innovation-lover dominates the aggregate.
    expect(reception.metascore).toBeGreaterThan(plainMean + 3);
  });

  it("scores stay clamped to 0–100 at the extremes and an empty roster throws", () => {
    const stellar = reviewCritics(
      {
        axes: flatAxes(100),
        q: 100,
        expectation: {
          marketingHype: 0,
          scopeTier: "prototype",
          reputation: 100,
          sequelPedigree: 0,
        },
        context: {
          genreTrend: "rising",
          topicTrend: "rising",
          windowCrowding: "clear",
          platformFit: 1.1,
          isSequel: false,
        },
      },
      OUTLETS,
      () => 1,
    );
    for (const review of stellar.reviews) {
      expect(review.score).toBeLessThanOrEqual(100);
    }
    const disaster = reviewCritics(
      {
        axes: flatAxes(2),
        q: 2,
        expectation: {
          marketingHype: 100,
          scopeTier: "aaa",
          reputation: 0,
          sequelPedigree: 100,
        },
        context: {
          genreTrend: "fatigued",
          topicTrend: "fatigued",
          windowCrowding: "crowded",
          platformFit: 0.85,
          isSequel: true,
        },
      },
      OUTLETS,
      () => 0,
    );
    for (const review of disaster.reviews) {
      expect(review.score).toBeGreaterThanOrEqual(0);
    }
    expect(() => reviewCritics(plainInputs, [], noNoise)).toThrow();
  });
});
