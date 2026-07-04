import { describe, expect, it } from "vitest";
import {
  advanceProduction,
  advanceReveal,
  beginProduction,
  completePostMortem,
  createLoop,
  enterShipDecision,
  finishReveal,
  greenlightConcept,
  isRevealComplete,
  launch,
  resolveEvent,
  setAllocation,
  setCrunch,
  shipPolish,
  startNextProject,
  type LoopState,
  type StudioState,
} from "./loop";
import { isProductionComplete } from "./milestones";
import type { ConceptDraft } from "./conception";
import type { Specialty, Staff } from "./types";
import { OUTLETS } from "./data/outlets";

const quietRng = () => 0.99;

function makeStaff(id: string, specialty: Specialty, skill: number): Staff {
  return {
    id,
    name: `${specialty}-${id}`,
    specialty,
    skills: {
      designer: 30,
      programmer: 30,
      artist: 30,
      audio: 25,
      writer: 30,
      producer: 25,
      qa: 35,
      [specialty]: skill,
    },
    morale: 85,
    burnout: 5,
  };
}

/** A strong small studio, so the test project lands well. */
function seedStudio(): StudioState {
  return {
    name: "Garage Games",
    cash: 50_000,
    reputation: 10,
    year: 1985,
    ipCatalog: [],
    staff: [
      makeStaff("s1", "designer", 78),
      makeStaff("s2", "programmer", 75),
      makeStaff("s3", "artist", 75),
      makeStaff("s4", "writer", 72),
      makeStaff("s5", "qa", 70),
    ],
    engines: [{ id: "engine-1", name: "HomeBrew 1.0", techLevel: 70 }],
  };
}

const draft: ConceptDraft = {
  title: "Dungeon of the Space Crown",
  basis: { kind: "new-ip" },
  genres: ["rpg"],
  topic: "fantasy",
  platforms: ["pc"],
  scopeTier: "indie",
};

/** Drives the whole §3 loop with deterministic rng; returns every waypoint. */
function playOneProject(): { states: Record<string, LoopState>; final: LoopState } {
  const states: Record<string, LoopState> = {};
  let s = createLoop(seedStudio());
  states.conceive = s;

  s = greenlightConcept(s, draft);
  states.preProduction = s;

  s = beginProduction(s, { engineId: "engine-1", riskTaking: 60 });
  s = setAllocation(s, "content", 22);
  s = setAllocation(s, "narrative", 20);
  s = setAllocation(s, "audio", 8);
  s = setCrunch(s, false);
  while (s.run && !isProductionComplete(s.run)) {
    s = advanceProduction(s, quietRng);
  }
  states.productionDone = s;

  s = enterShipDecision(s);
  s = shipPolish(s); // one polish round before going gold
  states.ship = s;

  s = launch(
    s,
    { releaseWindow: { year: 1986, quarter: 3 }, marketingHype: 35, price: 50, platforms: ["pc"] },
    () => 0.5,
  );
  states.reception = s;

  while (s.reveal && !isRevealComplete(s.reveal)) {
    s = advanceReveal(s);
  }
  s = finishReveal(s);
  states.postMortem = s;

  s = completePostMortem(s);
  states.grow = s;

  const final = startNextProject(s);
  return { states, final };
}

describe("the §3 core loop, end to end", () => {
  const { states, final } = playOneProject();

  it("walks every beat in order", () => {
    expect(states.conceive!.phase).toBe("conceive");
    expect(states.preProduction!.phase).toBe("pre-production");
    expect(states.productionDone!.phase).toBe("production");
    expect(states.ship!.phase).toBe("ship");
    expect(states.reception!.phase).toBe("reception");
    expect(states.postMortem!.phase).toBe("post-mortem");
    expect(states.grow!.phase).toBe("grow");
    expect(final.phase).toBe("conceive");
  });

  it("the launch produced a full reveal package and a strong landing", () => {
    const { launch: result } = states.reception!;
    expect(result!.reception.reviews).toHaveLength(OUTLETS.length);
    expect(result!.reception.metascore).toBeGreaterThan(65);
    expect(result!.userScore).toBeGreaterThan(60);
    expect(result!.postMortem.summary.text.length).toBeGreaterThan(0);
  });

  it("grow compounds the outcome: cash, reputation, franchise IP, healed team", () => {
    const grow = states.grow!;
    expect(grow.growth!.revenue).toBeGreaterThan(0);
    expect(grow.growth!.reputationDelta).toBeGreaterThan(0);
    expect(grow.studio.reputation).toBeGreaterThan(10);
    // Revenue landed in the bank on top of all the spending.
    expect(grow.studio.cash).toBeGreaterThan(states.ship!.studio.cash);
    // The well-received original became franchise IP…
    expect(grow.growth!.ip).not.toBeNull();
    expect(grow.studio.ipCatalog).toHaveLength(1);
    // …the year moved to the release window, and downtime healed the team.
    expect(grow.studio.year).toBe(1986);
    for (const member of grow.studio.staff) {
      expect(member.burnout).toBeLessThanOrEqual(5);
    }
  });

  it("the next project starts clean but the studio persists — and can sequelize", () => {
    expect(final.game).toBeNull();
    expect(final.run).toBeNull();
    expect(final.launch).toBeNull();
    expect(final.studio.ipCatalog).toHaveLength(1);
    // The new IP supports a sequel concept on the next lap.
    const sequelDraft: ConceptDraft = {
      ...draft,
      title: "Space Crown II",
      basis: { kind: "sequel", ipId: final.studio.ipCatalog[0]!.id },
    };
    const next = greenlightConcept(final, sequelDraft);
    expect(next.game!.ipId).toBe(final.studio.ipCatalog[0]!.id);
    expect(next.game!.isSequelOf).toBe("game-1");
  });
});

describe("the staggered reveal (§3 beat 6)", () => {
  it("rolls in reviews one at a time, then the user score, then the Metascore", () => {
    let s = states().reception!;
    expect(s.reveal!.reviewsRevealed).toBe(0);
    for (let i = 1; i <= s.reveal!.totalReviews; i++) {
      s = advanceReveal(s);
      expect(s.reveal!.reviewsRevealed).toBe(i);
      expect(s.reveal!.userScoreRevealed).toBe(false);
    }
    s = advanceReveal(s);
    expect(s.reveal!.userScoreRevealed).toBe(true);
    expect(s.reveal!.metascoreRevealed).toBe(false);
    s = advanceReveal(s);
    expect(s.reveal!.metascoreRevealed).toBe(true);
    expect(isRevealComplete(s.reveal!)).toBe(true);
    expect(() => advanceReveal(s)).toThrow(/complete/);
    expect(finishReveal(s).phase).toBe("post-mortem");
  });

  it("cannot be skipped to the post-mortem early", () => {
    const s = states().reception!;
    expect(() => finishReveal(s)).toThrow(/still rolling/);
  });

  function states() {
    return playOneProject().states;
  }
});

describe("phase guards", () => {
  const start = createLoop(seedStudio());

  it("every transition validates its phase", () => {
    expect(() => beginProduction(start, { engineId: "engine-1", riskTaking: 50 })).toThrow(
      /phase/,
    );
    expect(() => advanceProduction(start, quietRng)).toThrow(/phase/);
    expect(() => enterShipDecision(start)).toThrow(/phase/);
    expect(() => shipPolish(start)).toThrow(/phase/);
    expect(() =>
      launch(start, { releaseWindow: { year: 1986, quarter: 1 }, marketingHype: 0, price: 50, platforms: ["pc"] }, quietRng),
    ).toThrow(/phase/);
    expect(() => advanceReveal(start)).toThrow(/phase/);
    expect(() => completePostMortem(start)).toThrow(/phase/);
    expect(() => startNextProject(start)).toThrow(/phase/);
  });

  it("rejects an invalid concept and an unknown engine", () => {
    expect(() => greenlightConcept(start, { ...draft, title: "" })).toThrow(/not ready/);
    const greenlit = greenlightConcept(start, draft);
    expect(() => beginProduction(greenlit, { engineId: "vaporware", riskTaking: 50 })).toThrow(
      /Unknown engine/,
    );
  });

  it("refuses the Ship Decision before content-complete", () => {
    let s = greenlightConcept(start, draft);
    s = beginProduction(s, { engineId: "engine-1", riskTaking: 50 });
    expect(() => enterShipDecision(s)).toThrow(/content-complete/);
  });
});

describe("mid-loop bookkeeping", () => {
  it("production event costs settle against studio cash", () => {
    let s = greenlightConcept(createLoop(seedStudio()), draft);
    s = beginProduction(s, { engineId: "engine-1", riskTaking: 50 });
    // Force a poaching event (event roll, then pick index 1).
    s = advanceProduction(s, (() => {
      const seq = [0.01, 0.4];
      return () => seq.shift() ?? 0.99;
    })());
    expect(s.run!.pendingEvent!.id).toBe("poaching-attempt");
    const cashBefore = s.studio.cash;
    s = resolveEvent(s, "counter-offer", quietRng);
    expect(s.studio.cash).toBeLessThan(cashBefore);
    expect(s.phase).toBe("production");
  });

  it("ship levers and marketing settle against studio cash", () => {
    const { states } = playOneProject();
    const shipped = states.ship!;
    const preLaunchCash = shipped.studio.cash;
    const launched = launch(
      shipped,
      { releaseWindow: { year: 1986, quarter: 3 }, marketingHype: 50, price: 50, platforms: ["pc"] },
      () => 0.5,
    );
    expect(launched.studio.cash).toBe(preLaunchCash - 50 * 200);
  });
});
