import { describe, expect, it } from "vitest";
import { clamp, computeQuality } from "./quality";
import type { AxisScores, GenreWeights } from "./types";

const uniformWeights: GenreWeights = {
  gameplay: 1,
  content: 1,
  presentation: 1,
  narrative: 1,
  innovation: 1,
  polish: 1,
};

describe("clamp", () => {
  it("clamps below, inside, and above the range", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(150, 0, 100)).toBe(100);
  });
});

describe("computeQuality", () => {
  it("returns the plain average under uniform weights", () => {
    const axes: AxisScores = {
      gameplay: 80,
      content: 80,
      presentation: 80,
      narrative: 80,
      innovation: 80,
      polish: 80,
    };
    expect(computeQuality(axes, uniformWeights)).toBe(80);
  });

  it("weights emphasized axes more heavily", () => {
    // A "Puzzle-ish" profile: gameplay/innovation matter, content/presentation don't.
    const weights: GenreWeights = {
      gameplay: 3,
      content: 0.5,
      presentation: 0.5,
      narrative: 1,
      innovation: 3,
      polish: 1,
    };
    const strongFit: AxisScores = {
      gameplay: 90,
      content: 40,
      presentation: 40,
      narrative: 60,
      innovation: 90,
      polish: 70,
    };
    const weakFit: AxisScores = {
      gameplay: 40,
      content: 90,
      presentation: 90,
      narrative: 60,
      innovation: 40,
      polish: 70,
    };
    expect(computeQuality(strongFit, weights)).toBeGreaterThan(
      computeQuality(weakFit, weights),
    );
  });

  it("reproduces the worked example from GDD §7.12 (Q ≈ 79)", () => {
    // Open-world Action-RPG sequel: Presentation 88, Content 84, Gameplay 80,
    // Narrative 78, Innovation 55, Polish 60 → Q ≈ 79 under an RPG-leaning blend.
    const axes: AxisScores = {
      gameplay: 80,
      content: 84,
      presentation: 88,
      narrative: 78,
      innovation: 55,
      polish: 60,
    };
    const actionRpgWeights: GenreWeights = {
      gameplay: 2,
      content: 2,
      presentation: 1.5,
      narrative: 1.5,
      innovation: 0.5,
      polish: 1,
    };
    const q = computeQuality(axes, actionRpgWeights);
    expect(q).toBeGreaterThan(75);
    expect(q).toBeLessThan(83);
  });

  it("clamps out-of-range axis inputs and rejects zero-sum weights", () => {
    const axes: AxisScores = {
      gameplay: 150,
      content: -20,
      presentation: 100,
      narrative: 0,
      innovation: 100,
      polish: 0,
    };
    expect(computeQuality(axes, uniformWeights)).toBeCloseTo(50);
    expect(() =>
      computeQuality(axes, { ...uniformWeights, gameplay: -6, content: 0, presentation: 0, narrative: 0, innovation: 0, polish: 0 }),
    ).toThrow();
  });
});
