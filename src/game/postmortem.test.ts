import { describe, expect, it } from "vitest";
import { generatePostMortem, type PostMortemInputs } from "./postmortem";
import { computeUserScore, reviewCritics, type ReviewInputs } from "./reviews";
import { OUTLETS } from "./data/outlets";
import { GENRE_PROFILES } from "./data/genres";
import type { AxisScores } from "./types";

const noNoise = () => 0.5;

/** Builds full post-mortem inputs by actually running the review pipeline. */
function runPipeline(
  review: ReviewInputs,
  production: Pick<PostMortemInputs, "scopePressure" | "cutCorners" | "price">,
  genreProfile = GENRE_PROFILES.rpg,
): PostMortemInputs {
  const reception = reviewCritics(review, OUTLETS, noNoise);
  const userScore = computeUserScore({
    axes: review.axes,
    q: review.q,
    gap: reception.gap,
    price: production.price,
    sentiment: 50,
  });
  return {
    axes: review.axes,
    q: review.q,
    genreProfile,
    reception,
    userScore,
    context: review.context,
    ...production,
  };
}

/** The §7.12 worked example: over-hyped, over-scoped sequel shipped buggy into a crowded window. */
function workedExampleInputs(): PostMortemInputs {
  return runPipeline(
    {
      axes: {
        gameplay: 80,
        content: 84,
        presentation: 88,
        narrative: 78,
        innovation: 55,
        polish: 60,
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
    },
    {
      scopePressure: 70,
      cutCorners: { featuresCut: 20, shippedBugs: 45, crunch: 30 },
      price: 50,
    },
  );
}

const healthyAxes: AxisScores = {
  gameplay: 82,
  content: 84,
  presentation: 80,
  narrative: 83,
  innovation: 78,
  polish: 85,
};

/** A well-run launch: honest marketing, clear window, clean build. */
function healthyInputs(): PostMortemInputs {
  return runPipeline(
    {
      axes: healthyAxes,
      q: 82,
      expectation: {
        marketingHype: 60,
        scopeTier: "double-a",
        reputation: 50,
        sequelPedigree: 60,
      }, // ExpectedQuality ≈ 76 → small positive gap
      context: {
        genreTrend: "neutral",
        topicTrend: "neutral",
        windowCrowding: "normal",
        platformFit: 1,
        isSequel: false,
      },
    },
    { scopePressure: 20, cutCorners: { featuresCut: 0, shippedBugs: 5, crunch: 10 }, price: 50 },
  );
}

describe("the §7.12 post-mortem: over-hyped and rough launch, not a quality problem", () => {
  const pm = generatePostMortem(workedExampleInputs());
  const ids = pm.diagnoses.map((d) => d.id);

  it("diagnoses hype, launch roughness, and the landing — not the game", () => {
    expect(ids).toContain("over-hyped");
    expect(ids).toContain("under-polished");
    expect(ids).toContain("bad-window");
    expect(ids).toContain("iteration-fatigue");
    expect(ids).toContain("over-scoped");
    expect(ids).not.toContain("quality-shortfall");
    expect(ids).not.toContain("starved-genre-axis");
  });

  it("summarizes it as a strong game with a weak landing (§7.12's lesson)", () => {
    expect(pm.summary.id).toBe("strong-game-weak-landing");
    expect(pm.summary.text).toContain("not quality");
  });

  it("flags the right axes in the breakdown", () => {
    const byAxis = Object.fromEntries(pm.axisBreakdown.map((e) => [e.axis, e]));
    expect(byAxis.innovation!.verdict).toBe("under-performed");
    expect(byAxis.polish!.verdict).toBe("under-performed");
    expect(byAxis.presentation!.verdict).toBe("over-performed");
    expect(byAxis.content!.verdict).toBe("on-target");
    // RPG profile: Content and Narrative are what the genre judges hardest.
    expect(byAxis.content!.emphasis).toBe("emphasized");
    expect(byAxis.narrative!.emphasis).toBe("emphasized");
  });

  it("generates the §7.10-style contrast pull-quote plus a hype quote", () => {
    // Best axis: Presentation 88; worst: Innovation 55.
    expect(pm.pullQuotes[0]).toBe("Stunning to look at, but it plays it painfully safe.");
    expect(pm.pullQuotes).toContain("It doesn't quite live up to the hype.");
  });

  it("tops the user complaints with launch bugs, per §7.10", () => {
    expect(pm.userComplaints.length).toBeGreaterThan(0);
    expect(pm.userComplaints[0]!.id).toBe("launch-bugs");
    expect(pm.userComplaints.map((c) => c.id)).toContain("over-promised");
    // Sorted by severity, descending.
    for (let i = 1; i < pm.userComplaints.length; i++) {
      expect(pm.userComplaints[i]!.severity).toBeLessThanOrEqual(
        pm.userComplaints[i - 1]!.severity,
      );
    }
  });
});

describe("other outcomes", () => {
  it("a healthy launch gets a clean bill: no diagnoses, no complaints, praise quote", () => {
    const pm = generatePostMortem(healthyInputs());
    expect(pm.diagnoses).toHaveLength(0);
    expect(pm.summary.id).toBe("clean-landing");
    expect(pm.userComplaints).toHaveLength(0);
    expect(pm.pullQuotes[0]).not.toContain(", but ");
  });

  it("a genuinely weak game is diagnosed as a quality shortfall, not bad luck", () => {
    const weak = runPipeline(
      {
        axes: {
          gameplay: 45,
          content: 50,
          presentation: 48,
          narrative: 42,
          innovation: 40,
          polish: 55,
        },
        q: 47,
        expectation: {
          marketingHype: 20,
          scopeTier: "indie",
          reputation: 30,
          sequelPedigree: 0,
        },
        context: {
          genreTrend: "neutral",
          topicTrend: "neutral",
          windowCrowding: "normal",
          platformFit: 1,
          isSequel: false,
        },
      },
      { scopePressure: 30, cutCorners: { featuresCut: 10, shippedBugs: 20, crunch: 20 }, price: 50 },
    );
    const pm = generatePostMortem(weak);
    expect(pm.diagnoses.map((d) => d.id)).toContain("quality-shortfall");
    expect(pm.summary.id).toBe("quality-shortfall");
  });

  it("starving a genre-critical axis is called out by name (§5's promise)", () => {
    const starvedNarrative = runPipeline(
      {
        axes: { ...healthyAxes, narrative: 40 },
        q: 72,
        expectation: {
          marketingHype: 50,
          scopeTier: "double-a",
          reputation: 50,
          sequelPedigree: 0,
        },
        context: {
          genreTrend: "neutral",
          topicTrend: "neutral",
          windowCrowding: "normal",
          platformFit: 1,
          isSequel: false,
        },
      },
      { scopePressure: 20, cutCorners: { featuresCut: 0, shippedBugs: 5, crunch: 0 }, price: 50 },
      GENRE_PROFILES.rpg, // RPG emphasizes Narrative
    );
    const pm = generatePostMortem(starvedNarrative);
    const starved = pm.diagnoses.find((d) => d.id === "starved-genre-axis");
    expect(starved).toBeDefined();
    expect(starved!.text).toContain("Narrative");
  });

  it("platform mismatch and tired trends are detected from context", () => {
    const inputs = healthyInputs();
    inputs.context = {
      ...inputs.context,
      platformFit: 0.9,
      genreTrend: "fatigued",
    };
    const ids = generatePostMortem(inputs).diagnoses.map((d) => d.id);
    expect(ids).toContain("platform-mismatch");
    expect(ids).toContain("trend-fatigued");
  });

  it("a cheap, humble overachiever earns the darling quote and no hype complaints", () => {
    const darling = runPipeline(
      {
        axes: { ...healthyAxes, presentation: 70 },
        q: 78,
        expectation: {
          marketingHype: 5,
          scopeTier: "prototype",
          reputation: 10,
          sequelPedigree: 0,
        },
        context: {
          genreTrend: "neutral",
          topicTrend: "neutral",
          windowCrowding: "normal",
          platformFit: 1,
          isSequel: false,
        },
      },
      { scopePressure: 10, cutCorners: { featuresCut: 0, shippedBugs: 0, crunch: 0 }, price: 30 },
    );
    const pm = generatePostMortem(darling);
    expect(pm.pullQuotes).toContain("A quiet surprise that outperforms its modest promises.");
    expect(pm.userComplaints.map((c) => c.id)).not.toContain("over-promised");
  });

  it("is deterministic: same inputs, same post-mortem", () => {
    expect(generatePostMortem(workedExampleInputs())).toEqual(
      generatePostMortem(workedExampleInputs()),
    );
  });
});
