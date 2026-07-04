import { describe, expect, it } from "vitest";
import {
  PRODUCTION_TUNING,
  baseFromEffort,
  cutCornerPenalty,
  genreFitFactor,
  produceAxes,
  scopeFactor,
  techFactor,
  type ProductionInputs,
} from "./production";
import { GENRE_PROFILES } from "./data/genres";
import { QUALITY_AXES } from "./types";

/** A competent, healthy production: strong effort everywhere, skilled team, good engine. */
function wellMadeInputs(): ProductionInputs {
  return {
    workstreams: {
      gameplay: { effort: 85, skill: 80 },
      content: { effort: 85, skill: 80 },
      tech: { effort: 80, skill: 80 },
      art: { effort: 85, skill: 80 },
      audio: { effort: 80, skill: 75 },
      narrative: { effort: 85, skill: 80 },
      polish: { effort: 85, skill: 80 },
    },
    riskTaking: 75,
    engineTechLevel: 85,
    scopePressure: 15,
    cutCorners: { featuresCut: 0, shippedBugs: 5, crunch: 0 },
  };
}

describe("baseFromEffort", () => {
  it("grows with effort and with skill, with diminishing returns on effort", () => {
    expect(baseFromEffort(80, 80)).toBeGreaterThan(baseFromEffort(40, 80));
    expect(baseFromEffort(80, 80)).toBeGreaterThan(baseFromEffort(80, 40));
    // Diminishing returns: the second 40 points of effort add less than the first.
    const firstHalf = baseFromEffort(40, 80) - baseFromEffort(0, 80);
    const secondHalf = baseFromEffort(80, 80) - baseFromEffort(40, 80);
    expect(secondHalf).toBeLessThan(firstHalf);
  });

  it("produces nothing from zero effort, and caps at 100", () => {
    expect(baseFromEffort(0, 100)).toBe(0);
    expect(baseFromEffort(100, 100)).toBeCloseTo(100);
    expect(baseFromEffort(150, 150)).toBeCloseTo(100); // inputs clamped
  });
});

describe("produceAxes — the §7.3 pipeline", () => {
  it("a well-made game scores high on every axis and on Q", () => {
    const { axes, q } = produceAxes(wellMadeInputs(), GENRE_PROFILES.rpg);
    for (const axis of QUALITY_AXES) {
      expect(axes[axis]).toBeGreaterThanOrEqual(60);
      expect(axes[axis]).toBeLessThanOrEqual(100);
    }
    expect(q).toBeGreaterThanOrEqual(70);
  });

  it("is pure and deterministic", () => {
    const a = produceAxes(wellMadeInputs(), GENRE_PROFILES.rpg);
    const b = produceAxes(wellMadeInputs(), GENRE_PROFILES.rpg);
    expect(a).toEqual(b);
  });

  it("an over-scoped project takes the ScopeFactor hit", () => {
    const comfortable = produceAxes(
      { ...wellMadeInputs(), scopePressure: 0 },
      GENRE_PROFILES.rpg,
    );
    const overScoped = produceAxes(
      { ...wellMadeInputs(), scopePressure: 90 },
      GENRE_PROFILES.rpg,
    );
    expect(overScoped.q).toBeLessThan(comfortable.q);
    // The hit should be material — this is the "AAA bet that missed" (§4).
    expect(overScoped.q).toBeLessThan(comfortable.q * 0.85);
    // And it should track scopeFactor: every axis shrinks, none is spared.
    for (const axis of QUALITY_AXES) {
      expect(overScoped.axes[axis]).toBeLessThan(comfortable.axes[axis]);
    }
  });

  it("starving a genre-critical workstream tanks that axis (§5's self-inflicted wound)", () => {
    const inputs = wellMadeInputs();
    inputs.workstreams.narrative = { effort: 5, skill: 80 }; // RPG needs Narrative
    const { axes, q } = produceAxes(inputs, GENRE_PROFILES.rpg);
    const healthy = produceAxes(wellMadeInputs(), GENRE_PROFILES.rpg);

    expect(axes.narrative).toBeLessThan(25);
    expect(healthy.axes.narrative).toBeGreaterThan(70);
    // Narrative is emphasized for RPG, so Q suffers disproportionately.
    expect(q).toBeLessThan(healthy.q - 10);
    // Unrelated axes stay in the same ballpark (only the global fit factor moves).
    expect(axes.gameplay).toBeGreaterThan(60);
  });

  it("a low engine level caps Presentation and Polish but not the other axes", () => {
    const garage = produceAxes(
      { ...wellMadeInputs(), engineTechLevel: 10 },
      GENRE_PROFILES.rpg,
    );
    const modern = produceAxes(
      { ...wellMadeInputs(), engineTechLevel: 90 },
      GENRE_PROFILES.rpg,
    );
    expect(garage.axes.presentation).toBeLessThan(modern.axes.presentation * 0.8);
    expect(garage.axes.polish).toBeLessThan(modern.axes.polish * 0.8);
    for (const axis of ["gameplay", "content", "narrative", "innovation"] as const) {
      expect(garage.axes[axis]).toBeCloseTo(modern.axes[axis]);
    }
  });

  it("cut features hit Content hardest; shipped bugs hit Polish hardest (§6)", () => {
    const clean = produceAxes(wellMadeInputs(), GENRE_PROFILES.rpg);

    const cut = produceAxes(
      { ...wellMadeInputs(), cutCorners: { featuresCut: 80, shippedBugs: 5, crunch: 0 } },
      GENRE_PROFILES.rpg,
    );
    expect(clean.axes.content - cut.axes.content).toBeGreaterThan(
      clean.axes.gameplay - cut.axes.gameplay,
    );

    const buggy = produceAxes(
      { ...wellMadeInputs(), cutCorners: { featuresCut: 0, shippedBugs: 80, crunch: 0 } },
      GENRE_PROFILES.rpg,
    );
    expect(clean.axes.polish - buggy.axes.polish).toBeGreaterThan(
      clean.axes.content - buggy.axes.content,
    );
  });

  it("crunch damage drags every axis down", () => {
    const rested = produceAxes(wellMadeInputs(), GENRE_PROFILES.rpg);
    const crunched = produceAxes(
      { ...wellMadeInputs(), cutCorners: { featuresCut: 0, shippedBugs: 5, crunch: 90 } },
      GENRE_PROFILES.rpg,
    );
    for (const axis of QUALITY_AXES) {
      expect(crunched.axes[axis]).toBeLessThan(rested.axes[axis]);
    }
  });

  it("matching effort to the genre profile beats the same effort misallocated", () => {
    // A puzzle game needs Gameplay + Innovation, not Content + Presentation (§4).
    const matched = wellMadeInputs();
    matched.workstreams.gameplay.effort = 95;
    matched.riskTaking = 95;
    matched.workstreams.content.effort = 40;
    matched.workstreams.art.effort = 40;
    matched.workstreams.audio.effort = 40;

    const mismatched = wellMadeInputs();
    mismatched.workstreams.gameplay.effort = 40;
    mismatched.riskTaking = 40;
    mismatched.workstreams.content.effort = 95;
    mismatched.workstreams.art.effort = 95;
    mismatched.workstreams.audio.effort = 95;

    const puzzle = GENRE_PROFILES.puzzle;
    expect(produceAxes(matched, puzzle).q).toBeGreaterThan(
      produceAxes(mismatched, puzzle).q + 10,
    );
  });

  it("clamps every axis to 0–100 under extreme inputs", () => {
    const maxed: ProductionInputs = {
      workstreams: {
        gameplay: { effort: 100, skill: 100 },
        content: { effort: 100, skill: 100 },
        tech: { effort: 100, skill: 100 },
        art: { effort: 100, skill: 100 },
        audio: { effort: 100, skill: 100 },
        narrative: { effort: 100, skill: 100 },
        polish: { effort: 100, skill: 100 },
      },
      riskTaking: 100,
      engineTechLevel: 100,
      scopePressure: 0,
      cutCorners: { featuresCut: 0, shippedBugs: 0, crunch: 0 },
    };
    const gutted: ProductionInputs = {
      workstreams: {
        gameplay: { effort: 0, skill: 0 },
        content: { effort: 0, skill: 0 },
        tech: { effort: 0, skill: 0 },
        art: { effort: 0, skill: 0 },
        audio: { effort: 0, skill: 0 },
        narrative: { effort: 0, skill: 0 },
        polish: { effort: 0, skill: 0 },
      },
      riskTaking: 0,
      engineTechLevel: 0,
      scopePressure: 100,
      cutCorners: { featuresCut: 100, shippedBugs: 100, crunch: 100 },
    };
    for (const result of [produceAxes(maxed, GENRE_PROFILES.rpg), produceAxes(gutted, GENRE_PROFILES.rpg)]) {
      for (const axis of QUALITY_AXES) {
        expect(result.axes[axis]).toBeGreaterThanOrEqual(0);
        expect(result.axes[axis]).toBeLessThanOrEqual(100);
      }
      expect(result.q).toBeGreaterThanOrEqual(0);
      expect(result.q).toBeLessThanOrEqual(100);
    }
    expect(produceAxes(gutted, GENRE_PROFILES.rpg).q).toBe(0);
  });
});

describe("formula pieces", () => {
  it("techFactor rises with engine level and is dragged by a neglected tech workstream", () => {
    expect(techFactor(90, 80)).toBeGreaterThan(techFactor(10, 80));
    expect(techFactor(90, 80)).toBeGreaterThan(techFactor(90, 0));
    // Floor: even tech 0 renders something.
    expect(techFactor(0, 0)).toBe(PRODUCTION_TUNING.TECH_FACTOR_FLOOR);
    expect(techFactor(100, 100)).toBe(1);
  });

  it("scopeFactor is 1 with no pressure and steepens as pressure grows", () => {
    expect(scopeFactor(0)).toBe(1);
    expect(scopeFactor(100)).toBeCloseTo(1 - PRODUCTION_TUNING.OVERSCOPE_STEEPNESS);
    // Convex: the second half of the pressure range costs more than the first.
    const firstHalf = scopeFactor(0) - scopeFactor(50);
    const secondHalf = scopeFactor(50) - scopeFactor(100);
    expect(secondHalf).toBeGreaterThan(firstHalf);
  });

  it("genreFitFactor rewards a matched allocation and penalizes ignoring the profile", () => {
    const profile = GENRE_PROFILES.puzzle;
    const matched = {
      gameplay: 80,
      content: 20,
      presentation: 20,
      narrative: 40,
      innovation: 80,
      polish: 40,
    };
    const inverted = {
      gameplay: 20,
      content: 80,
      presentation: 80,
      narrative: 40,
      innovation: 20,
      polish: 40,
    };
    expect(genreFitFactor(matched, profile)).toBeGreaterThan(1);
    expect(genreFitFactor(inverted, profile)).toBeLessThan(1);
    // Neutral when nothing has been allocated (no signal to judge).
    expect(genreFitFactor(
      { gameplay: 0, content: 0, presentation: 0, narrative: 0, innovation: 0, polish: 0 },
      profile,
    )).toBe(1);
  });

  it("cutCornerPenalty targets the right axes", () => {
    const corners = { featuresCut: 100, shippedBugs: 100, crunch: 100 };
    expect(cutCornerPenalty(corners, "content")).toBeGreaterThan(
      cutCornerPenalty(corners, "gameplay"),
    );
    expect(cutCornerPenalty(corners, "polish")).toBeGreaterThan(
      cutCornerPenalty(corners, "gameplay"),
    );
    expect(cutCornerPenalty({ featuresCut: 0, shippedBugs: 0, crunch: 0 }, "content")).toBe(0);
  });
});
