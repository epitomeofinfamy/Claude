import { describe, expect, it } from "vitest";
import {
  PROGRESSION_TUNING,
  allowedScopeTiers,
  conceptLocks,
  engineCeiling,
  lockedResearch,
  makeCandidate,
  maxStaff,
  officeUpgrade,
  startingResearch,
} from "./progression";
import { computeExpectedQuality } from "./reviews";
import { OFFICE_TIERS } from "./types";
import type { ConceptDraft } from "./conception";

describe("office tiers (§10)", () => {
  it("each move up raises team size, engine ceiling, and scope reach", () => {
    for (let i = 1; i < OFFICE_TIERS.length; i++) {
      const smaller = OFFICE_TIERS[i - 1]!;
      const bigger = OFFICE_TIERS[i]!;
      expect(maxStaff(bigger)).toBeGreaterThan(maxStaff(smaller));
      expect(engineCeiling(bigger)).toBeGreaterThanOrEqual(engineCeiling(smaller));
      expect(allowedScopeTiers(bigger).length).toBeGreaterThanOrEqual(
        allowedScopeTiers(smaller).length,
      );
    }
    expect(allowedScopeTiers("garage")).not.toContain("aaa");
    expect(allowedScopeTiers("studio")).toContain("aaa");
  });

  it("upgrades chain garage → indie → studio → aaa and stop at the top", () => {
    expect(officeUpgrade("garage")!.to).toBe("indie");
    expect(officeUpgrade("indie")!.to).toBe("studio");
    expect(officeUpgrade("studio")!.to).toBe("aaa");
    expect(officeUpgrade("aaa")).toBeNull();
    // Each move costs more and demands more reputation.
    expect(officeUpgrade("indie")!.cost).toBeGreaterThan(officeUpgrade("garage")!.cost);
    expect(officeUpgrade("indie")!.reputationGate).toBeGreaterThan(
      officeUpgrade("garage")!.reputationGate,
    );
  });
});

describe("research tree (§10)", () => {
  const draft: ConceptDraft = {
    title: "Test",
    basis: { kind: "new-ip" },
    genres: ["shooter"], // not in the starting set
    topic: "horror", // not in the starting set
    platforms: ["home-console"], // not in the starting set
    scopeTier: "aaa", // beyond a garage
  };

  it("locks unresearched genres/topics/platforms and oversized scopes", () => {
    const problems = conceptLocks(draft, startingResearch(), "garage");
    expect(problems).toHaveLength(4);
    expect(problems.join(" ")).toMatch(/shooter/);
    expect(problems.join(" ")).toMatch(/horror/);
    expect(problems.join(" ")).toMatch(/home-console/);
    expect(problems.join(" ")).toMatch(/garage office can't support/);
  });

  it("a researched concept in a big office clears", () => {
    const research = {
      genres: ["shooter" as const],
      topics: ["horror" as const],
      platforms: ["home-console" as const],
    };
    expect(conceptLocks(draft, research, "studio")).toEqual([]);
  });

  it("lockedResearch lists exactly what the starting studio can't make yet", () => {
    const locked = lockedResearch(startingResearch());
    expect(locked.genres.map((g) => g.id)).toEqual(["shooter", "strategy", "simulation"]);
    expect(locked.topics.map((t) => t.id)).toEqual(["crime", "horror"]);
    expect(locked.platforms.map((p) => p.id)).toEqual(["home-console"]);
    for (const item of [...locked.genres, ...locked.topics, ...locked.platforms]) {
      expect(item.cost).toBeGreaterThan(0);
    }
  });
});

describe("talent (§10: reputation attracts better people)", () => {
  it("candidate skill scales with reputation, capped", () => {
    const unknown = makeCandidate("programmer", 0, "a");
    const famous = makeCandidate("programmer", 80, "b");
    const legendary = makeCandidate("programmer", 200, "c");
    expect(famous.skills.programmer).toBeGreaterThan(unknown.skills.programmer);
    expect(legendary.skills.programmer).toBeLessThanOrEqual(
      PROGRESSION_TUNING.HIRE_SKILL_CAP,
    );
    expect(unknown.specialty).toBe("programmer");
    expect(unknown.burnout).toBe(0);
  });
});

describe("the reputation treadmill (§10 ↔ §7.6)", () => {
  it("reputation gains raise the ExpectedQuality bar for the next game", () => {
    const before = computeExpectedQuality({
      marketingHype: 40,
      scopeTier: "indie",
      reputation: 10,
      sequelPedigree: 0,
    });
    const after = computeExpectedQuality({
      marketingHype: 40,
      scopeTier: "indie",
      reputation: 40,
      sequelPedigree: 0,
    });
    expect(after).toBeGreaterThan(before);
  });

  it("franchise pedigree raises the bar the same way", () => {
    const newIp = computeExpectedQuality({
      marketingHype: 40,
      scopeTier: "indie",
      reputation: 30,
      sequelPedigree: 0,
    });
    const sequel = computeExpectedQuality({
      marketingHype: 40,
      scopeTier: "indie",
      reputation: 30,
      sequelPedigree: 70,
    });
    expect(sequel).toBeGreaterThan(newIp);
  });
});
