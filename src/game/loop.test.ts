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
  hireStaff,
  investInEngine,
  isRevealComplete,
  launch,
  researchUnlock,
  resolveEvent,
  resolveStudioEvent,
  setAllocation,
  setCrunch,
  shipPolish,
  startNextProject,
  trainTeam,
  upgradeOffice,
  type LoopState,
  type StudioState,
} from "./loop";
import { ECONOMY_TUNING } from "./economy";
import { startingResearch } from "./progression";
import { STUDIO_EVENT_TUNING } from "./studioEvents";
import type { LaunchPlan } from "./shipdecision";
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
    cash: 150_000,
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
    offices: "studio", // §10: big enough that scope isn't what these tests probe
    research: startingResearch(),
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
    // …the calendar moved with market time (milestones + the polish slip),
    // and downtime healed the team.
    expect(grow.studio.year).toBeGreaterThanOrEqual(1986);
    expect(grow.market.year).toBe(grow.studio.year);
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

describe("the economy (§9)", () => {
  /** A struggling studio: weak team, weak engine, thin runway. */
  function shakyStudio(cash: number): StudioState {
    return {
      ...seedStudio(),
      cash,
      reputation: 0,
      staff: [
        makeStaff("w1", "designer", 30),
        makeStaff("w2", "programmer", 30),
        makeStaff("w3", "artist", 30),
        makeStaff("w4", "writer", 30),
      ],
      engines: [{ id: "engine-1", name: "HomeBrew 0.1", techLevel: 5 }],
    };
  }

  function runProduction(s: LoopState): LoopState {
    while (s.phase === "production" && s.run && !isProductionComplete(s.run)) {
      s = advanceProduction(s, quietRng);
    }
    return s;
  }

  function throughReveal(s: LoopState): LoopState {
    while (s.reveal && !isRevealComplete(s.reveal)) s = advanceReveal(s);
    return finishReveal(s);
  }

  it("every production quarter costs payroll and overhead", () => {
    let s = greenlightConcept(createLoop(seedStudio()), draft);
    s = beginProduction(s, { engineId: "engine-1", riskTaking: 50 });
    const before = s.studio.cash;
    s = advanceProduction(s, quietRng);
    expect(s.studio.cash).toBeLessThan(before);
    expect(s.lastNotices.some((n) => n.text.includes("payroll & overhead"))).toBe(true);
  });

  it("a hit pays out over a front-loaded tail; the whole tail is the revenue", () => {
    const { states } = playOneProject();
    const growth = states.grow!.growth!;
    expect(growth.bankedNow).toBeGreaterThan(0);
    expect(growth.tail.length).toBeGreaterThanOrEqual(4);
    expect(growth.bankedNow).toBeGreaterThan(growth.tail[growth.tail.length - 1]!);
    expect(growth.bankedNow + growth.tail.reduce((a, b) => a + b, 0)).toBe(growth.revenue);
    // The tail keeps paying: the next project's first quarter banks a payout.
    let s = startNextProject(states.grow!);
    expect(s.pendingRevenue.length).toBeGreaterThan(0);
    const payout = s.pendingRevenue[0]!;
    s = greenlightConcept(s, { ...draft, title: "Next One" });
    s = beginProduction(s, { engineId: "engine-1", riskTaking: 50 });
    const before = s.studio.cash;
    s = advanceProduction(s, quietRng);
    expect(s.studio.cash).toBeCloseTo(
      before - 10_690 + payout, // burn for this 5-person roster is fixed
      0,
    );
  });

  it("hit path: the studio ends the project richer than it started", () => {
    const { states } = playOneProject();
    const grow = states.grow!;
    const totalIn = grow.growth!.revenue;
    const start = 150_000;
    // All future tail quarters included, the project made money.
    expect(grow.studio.cash + grow.pendingRevenue.reduce((a, b) => a + b, 0)).toBeGreaterThan(
      start,
    );
    expect(totalIn).toBeGreaterThan(0);
  });

  it("flop path: a weak game with a marketing debt ends in bankruptcy", () => {
    let s = greenlightConcept(createLoop(shakyStudio(40_000)), draft);
    s = beginProduction(s, { engineId: "engine-1", riskTaking: 5 });
    // Misallocate: everything into audio, starving what an RPG needs.
    for (const ws of ["gameplay", "content", "tech", "art", "narrative", "polish"] as const) {
      s = setAllocation(s, ws, 2);
    }
    s = setAllocation(s, "audio", 40);
    s = runProduction(s);
    expect(s.phase).toBe("production"); // survived production, barely
    s = enterShipDecision(s);
    const plan: LaunchPlan = {
      releaseWindow: { year: 1987, quarter: 1 },
      marketingHype: 100, // an over-marketed flop — the §9 death spiral
      price: 90,
      platforms: ["pc"],
    };
    s = launch(s, plan, () => 0.5);
    expect(s.studio.cash).toBeLessThan(0); // launch debt
    s = throughReveal(s);
    expect(s.launch!.reception.metascore).toBeLessThan(55);
    s = completePostMortem(s);
    expect(s.phase).toBe("bankrupt");
    expect(s.studio.cash).toBeLessThan(0);
  });

  it("bloated payroll on an over-scoped bet dies mid-production", () => {
    let s = greenlightConcept(createLoop(shakyStudio(25_000)), {
      ...draft,
      scopeTier: "aaa",
    });
    s = beginProduction(s, { engineId: "engine-1", riskTaking: 50 });
    let guard = 0;
    while (s.phase === "production" && guard++ < 15) {
      s = advanceProduction(s, quietRng);
    }
    expect(s.phase).toBe("bankrupt");
    expect(s.run!.milestoneIndex).toBeLessThan(s.run!.totalMilestones);
    expect(() => advanceProduction(s, quietRng)).toThrow(/phase/);
  });

  it("publisher deal: advance up front, marketing muscle, a cut of the take", () => {
    const funded = { ...seedStudio(), reputation: 40 };
    const drive = (funding: "self" | "publisher") => {
      let s = greenlightConcept(createLoop(funded), draft);
      const cashAtPrePro = s.studio.cash;
      s = beginProduction(s, { engineId: "engine-1", riskTaking: 60, funding });
      const advance = s.studio.cash - cashAtPrePro;
      s = setAllocation(s, "content", 22);
      s = setAllocation(s, "narrative", 20);
      s = runProduction(s);
      s = enterShipDecision(s);
      s = launch(
        s,
        { releaseWindow: { year: 1987, quarter: 2 }, marketingHype: 35, price: 50, platforms: ["pc"] },
        () => 0.5,
      );
      s = throughReveal(s);
      s = completePostMortem(s);
      return { state: s, advance };
    };
    const self = drive("self");
    const pub = drive("publisher");

    expect(self.advance).toBe(0);
    expect(pub.advance).toBe(ECONOMY_TUNING.PUBLISHER_ADVANCE_BY_TIER.indie);
    // The publisher's marketing machine raises the expectation baseline…
    expect(pub.state.launch!.reception.expectedQuality).toBeGreaterThan(
      self.state.launch!.reception.expectedQuality,
    );
    // …its muscle sells more units — and its cut still leaves you with less.
    expect(pub.state.growth!.units).toBeGreaterThan(self.state.growth!.units);
    expect(pub.state.growth!.revenue).toBeLessThan(self.state.growth!.revenue);
  });

  it("publisher deals are gated: low reputation gets no meeting", () => {
    let s = greenlightConcept(createLoop(seedStudio()), draft); // reputation 10
    expect(() =>
      beginProduction(s, { engineId: "engine-1", riskTaking: 50, funding: "publisher" }),
    ).toThrow(/No publisher deal/);
  });

  it("grow-phase reinvestment: engine R&D and training cost cash and pay off", () => {
    const grow = playOneProject().states.grow!;
    const upgraded = investInEngine(grow);
    expect(upgraded.studio.engines[0]!.techLevel).toBe(
      grow.studio.engines[0]!.techLevel + ECONOMY_TUNING.ENGINE_UPGRADE_TECH_GAIN,
    );
    expect(upgraded.studio.cash).toBe(grow.studio.cash - ECONOMY_TUNING.ENGINE_UPGRADE_COST);

    const trained = trainTeam(grow);
    expect(trained.studio.staff[0]!.skills[trained.studio.staff[0]!.specialty]).toBe(
      grow.studio.staff[0]!.skills[grow.studio.staff[0]!.specialty] +
        ECONOMY_TUNING.TRAINING_SKILL_GAIN,
    );

    const broke = { ...grow, studio: { ...grow.studio, cash: 100 } };
    expect(() => investInEngine(broke)).toThrow(/Not enough cash/);
    expect(() => trainTeam(broke)).toThrow(/Not enough cash/);
  });
});

describe("meta-progression (§10)", () => {
  /** Drives one conceive-phase state through an identical project to grow. */
  function driveProject(s: LoopState, title: string, genre?: "shooter"): LoopState {
    s = greenlightConcept(s, { ...draft, title, genres: [genre ?? "rpg"] });
    s = beginProduction(s, { engineId: "engine-1", riskTaking: 60 });
    s = setAllocation(s, "content", 22);
    s = setAllocation(s, "narrative", 20);
    while (s.run && !isProductionComplete(s.run)) s = advanceProduction(s, quietRng);
    s = enterShipDecision(s);
    s = launch(
      s,
      { releaseWindow: { year: 1987, quarter: 2 }, marketingHype: 35, price: 50, platforms: ["pc"] },
      () => 0.5,
    );
    while (s.reveal && !isRevealComplete(s.reveal)) s = advanceReveal(s);
    return completePostMortem(finishReveal(s));
  }

  it("success raises the bar: the same launch is judged against higher expectations", () => {
    const first = driveProject(createLoop(seedStudio()), "Dungeon of the Space Crown");
    expect(first.studio.reputation).toBeGreaterThan(10); // the hit paid reputation

    const second = driveProject(startNextProject(first), "Completely New Thing");
    // Identical game, marketing, scope, new IP — only reputation changed.
    expect(second.launch!.reception.expectedQuality).toBeGreaterThan(
      first.launch!.reception.expectedQuality,
    );
    // …and the higher bar shaves the same game's landing (§7.11's treadmill).
    expect(second.launch!.reception.gap).toBeLessThan(first.launch!.reception.gap);
  });

  it("locked content blocks greenlight until researched", () => {
    const shooterDraft: ConceptDraft = { ...draft, title: "Gun Thing", genres: ["shooter"] };
    expect(() => greenlightConcept(createLoop(seedStudio()), shooterDraft)).toThrow(
      /shooter isn't researched/,
    );

    let grow = driveProject(createLoop(seedStudio()), "First");
    grow = researchUnlock(grow, "genre", "shooter");
    expect(grow.studio.research.genres).toContain("shooter");
    const next = greenlightConcept(startNextProject(grow), shooterDraft);
    expect(next.game!.genres).toEqual(["shooter"]);
    expect(() => researchUnlock(grow, "genre", "rpg")).toThrow(/already researched/);
    expect(() => researchUnlock(grow, "genre", "vaporwave")).toThrow(/Unknown genre/);
  });

  it("the office gates project scope, and upgrading it is gated in turn", () => {
    const garage = createLoop({ ...seedStudio(), offices: "garage" });
    expect(() =>
      greenlightConcept(garage, { ...draft, scopeTier: "aaa" }),
    ).toThrow(/garage office can't support/);

    let grow = driveProject(createLoop({ ...seedStudio(), offices: "garage" }), "First");
    const poor = { ...grow, studio: { ...grow.studio, reputation: 5 } };
    expect(() => upgradeOffice(poor)).toThrow(/Reputation/);
    const broke = { ...grow, studio: { ...grow.studio, cash: 1_000 } };
    expect(() => upgradeOffice(broke)).toThrow(/Not enough cash/);
    grow = upgradeOffice(grow); // the hit's reputation + revenue open the indie office
    expect(grow.studio.offices).toBe("indie");
  });

  it("engine R&D is capped by the office's tech ceiling", () => {
    let grow = driveProject(createLoop(seedStudio()), "First"); // studio office: ceiling 80
    grow = investInEngine(grow); // 70 → 80, clamped at the ceiling
    expect(grow.studio.engines[0]!.techLevel).toBe(80);
    expect(() => investInEngine(grow)).toThrow(/tech ceiling/);
  });

  it("hiring: reputation attracts better people, and desks run out", () => {
    const grow = driveProject(createLoop(seedStudio()), "First");
    const hired = hireStaff(grow, "audio");
    expect(hired.studio.staff).toHaveLength(6);
    expect(hired.studio.cash).toBeLessThan(grow.studio.cash);
    const hire = hired.studio.staff[5]!;
    expect(hire.specialty).toBe("audio");
    // A famous studio pulls a stronger candidate for the same seat.
    const famous = hireStaff(
      { ...grow, studio: { ...grow.studio, reputation: 80 } },
      "audio",
    );
    expect(famous.studio.staff[5]!.skills.audio).toBeGreaterThan(hire.skills.audio);
    // No desks left in a garage.
    expect(() =>
      hireStaff({ ...grow, studio: { ...grow.studio, offices: "garage" } }, "audio"),
    ).toThrow(/office is full/);
  });
});

describe("studio events (§11)", () => {
  /** The hit playthrough, but with the Metascore doctored into award range. */
  function awardWorthyPostMortem(): LoopState {
    const s = playOneProject().states.postMortem!;
    return {
      ...s,
      launch: {
        ...s.launch!,
        reception: { ...s.launch!.reception, metascore: 88 },
      },
    };
  }

  it("a story beat can punctuate the grow phase, and blocks the next project", () => {
    const grow = completePostMortem(awardWorthyPostMortem(), () => 0);
    expect(grow.studioEvent).not.toBeNull();
    expect(grow.studioEvent!.id).toBe("award-show");
    expect(() => startNextProject(grow)).toThrow(/studio event/);
  });

  it("resolving applies the declared effects: the award pays reputation and morale", () => {
    const grow = completePostMortem(awardWorthyPostMortem(), () => 0);
    const before = grow.studio;
    const after = resolveStudioEvent(grow, "take-the-stage");
    expect(after.studioEvent).toBeNull();
    expect(after.studio.reputation).toBeCloseTo(
      before.reputation + STUDIO_EVENT_TUNING.AWARD_REPUTATION,
    );
    expect(after.studio.staff[0]!.morale).toBe(
      Math.min(100, before.staff[0]!.morale + STUDIO_EVENT_TUNING.AWARD_MORALE),
    );
    expect(startNextProject(after).phase).toBe("conceive");
  });

  it("a viral moment shoves the genre's hype curve — an §8 market condition", () => {
    const doctored = (() => {
      const s = playOneProject().states.postMortem!;
      return {
        ...s,
        launch: {
          ...s.launch!,
          userScore: 90, // beloved by players…
          reception: { ...s.launch!.reception, metascore: 72 }, // …snubbed by juries
        },
      };
    })();
    const grow = completePostMortem(doctored, () => 0);
    expect(grow.studioEvent!.id).toBe("viral-moment");
    const momentumBefore = grow.market.genreHype.rpg.momentum;
    const after = resolveStudioEvent(grow, "ride-wave");
    expect(after.market.genreHype.rpg.momentum).toBeGreaterThanOrEqual(momentumBefore);
    expect(after.market.genreHype.rpg.momentum).toBeLessThanOrEqual(8); // capped
  });

  it("a quiet outcome with a quiet roll tells no story", () => {
    const grow = completePostMortem(playOneProject().states.postMortem!, () => 0.999);
    expect(grow.studioEvent).toBeNull();
    expect(startNextProject(grow).phase).toBe("conceive");
  });

  it("rejects unknown options and double-resolution", () => {
    const grow = completePostMortem(awardWorthyPostMortem(), () => 0);
    expect(() => resolveStudioEvent(grow, "moonwalk")).toThrow(/Unknown option/);
    const resolved = resolveStudioEvent(grow, "take-the-stage");
    expect(() => resolveStudioEvent(resolved, "take-the-stage")).toThrow(/No studio event/);
  });
});
