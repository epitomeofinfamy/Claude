import { describe, expect, it } from "vitest";
import {
  SHIP_TUNING,
  applyCrunchRound,
  applyCutScope,
  applyDelay,
  applyPolishRound,
  createShipDecisionState,
  deriveGenreTrend,
  derivePlatformFit,
  deriveWindowCrowding,
  estimateReception,
  launchGame,
  type LaunchContext,
  type LaunchPlan,
  type ShipDecisionState,
} from "./shipdecision";
import {
  advanceMilestone,
  createProductionRun,
  isProductionComplete,
  type ProductionRunState,
} from "./milestones";
import { blendGenreProfiles, greenlightGame } from "./conception";
import { STUB_MARKET } from "./data/market";
import { OUTLETS } from "./data/outlets";
import type { Specialty, Staff, Workstream } from "./types";

const quietRng = () => 0.99;

function makeStaff(id: string, specialty: Specialty, skill: number, overrides: Partial<Staff> = {}): Staff {
  return {
    id,
    name: `${specialty}-${id}`,
    specialty,
    skills: {
      designer: 25,
      programmer: 25,
      artist: 25,
      audio: 20,
      writer: 25,
      producer: 20,
      qa: 30,
      [specialty]: skill,
    },
    morale: 80,
    burnout: 10,
    ...overrides,
  };
}

const team = () => [
  makeStaff("s1", "designer", 65),
  makeStaff("s2", "programmer", 60),
  makeStaff("s3", "artist", 60),
  makeStaff("s4", "writer", 55),
];

const allocation: Record<Workstream, number> = {
  gameplay: 15,
  content: 20,
  tech: 12,
  art: 12,
  audio: 8,
  narrative: 18,
  polish: 15,
};

function completedRun(crunchAll = false): ProductionRunState {
  let run = createProductionRun("indie", team(), allocation);
  run = { ...run, crunching: crunchAll };
  while (!isProductionComplete(run)) {
    run = { ...advanceMilestone(run, quietRng).run, crunching: crunchAll };
  }
  return run;
}

function shipState(): ShipDecisionState {
  return createShipDecisionState(completedRun());
}

const testGame = greenlightGame(
  {
    title: "Dungeon of the Space Crown",
    basis: { kind: "new-ip" },
    genres: ["rpg"],
    topic: "fantasy",
    platforms: ["pc"],
    scopeTier: "indie",
  },
  {
    gameId: "game-1",
    newIpId: "ip-1",
    engineId: "engine-1",
    releaseWindow: { year: 1985, quarter: 4 },
    ipCatalog: [],
  },
);

function plan(overrides: Partial<LaunchPlan> = {}): LaunchPlan {
  return {
    releaseWindow: { year: 1986, quarter: 2 },
    marketingHype: 40,
    price: 50,
    platforms: ["pc"],
    ...overrides,
  };
}

function ctx(overrides: Partial<LaunchContext> = {}): LaunchContext {
  return {
    game: testGame,
    genreProfile: blendGenreProfiles(["rpg"]),
    market: STUB_MARKET,
    outlets: OUTLETS,
    engineTechLevel: 60,
    riskTaking: 55,
    reputation: 20,
    sequelPedigree: 0,
    rng: () => 0.5,
    ...overrides,
  };
}

describe("entering the Ship Decision", () => {
  it("requires content-complete production", () => {
    expect(() => createShipDecisionState(createProductionRun("indie", team()))).toThrow(
      /content-complete/,
    );
    expect(shipState().remainingBugs).toBeGreaterThan(0);
  });

  it("crunchy production ships more open bugs; served Polish prevents them", () => {
    const clean = createShipDecisionState(completedRun(false));
    const crunchy = createShipDecisionState(completedRun(true));
    expect(crunchy.remainingBugs).toBeGreaterThan(clean.remainingBugs);

    const finished = completedRun();
    const noPolish = createShipDecisionState({
      ...finished,
      progress: { ...finished.progress, polish: 0 },
    });
    expect(noPolish.remainingBugs).toBeGreaterThan(clean.remainingBugs);
  });
});

/** Same state but with a visibly tired team, so recovery is observable. */
function tired(state: ShipDecisionState): ShipDecisionState {
  return {
    ...state,
    run: {
      ...state.run,
      staff: state.run.staff.map((s) => ({ ...s, burnout: 40 })),
    },
  };
}

describe("the four levers (§6 table)", () => {
  it("Polish: bugs ↓, Polish progress ↑ — costs time and budget, team rests", () => {
    const before = tired(shipState());
    const after = applyPolishRound(before);
    expect(after.remainingBugs).toBeLessThan(before.remainingBugs);
    expect(after.run.progress.polish).toBeGreaterThan(before.run.progress.polish);
    expect(after.delayedMilestones).toBe(1);
    expect(after.extraBudget).toBe(SHIP_TUNING.ROUND_COST_PER_STAFF * 4);
    expect(after.run.staff[0]!.burnout).toBeLessThan(before.run.staff[0]!.burnout);
  });

  it("Crunch: progress up, burnout up — no slip, but quit risk", () => {
    const before = shipState();
    const after = applyCrunchRound(before, quietRng);
    expect(after.run.progress.polish).toBeGreaterThan(before.run.progress.polish);
    expect(after.run.staff[0]!.burnout).toBeGreaterThan(before.run.staff[0]!.burnout);
    expect(after.run.staff[0]!.morale).toBeLessThan(before.run.staff[0]!.morale);
    expect(after.delayedMilestones).toBe(0); // that's the point of crunching
    // Crunch outproduces a plain polish round.
    expect(after.run.progress.polish).toBeGreaterThan(
      applyPolishRound(before).run.progress.polish,
    );
    // A torched staffer can walk out mid-crunch.
    const fried = {
      ...before,
      run: {
        ...before.run,
        staff: before.run.staff.map((s, i) => (i === 0 ? { ...s, burnout: 85 } : s)),
      },
    };
    const lost = applyCrunchRound(fried, () => 0.01);
    expect(lost.run.staff).toHaveLength(3);
    expect(lost.run.departedStaff).toContain("designer-s1");
  });

  it("Cut scope: Content down, Polish protected", () => {
    const base = shipState();
    const cut = applyCutScope(base);
    expect(cut.run.featuresCut).toBe(base.run.featuresCut + SHIP_TUNING.CUT_FEATURES);
    expect(cut.remainingBugs).toBeLessThan(base.remainingBugs);

    const baseAxes = launchGame(base, plan(), ctx()).axes;
    const cutAxes = launchGame(cut, plan(), ctx()).axes;
    expect(cutAxes.content).toBeLessThan(baseAxes.content); // the price
    expect(cutAxes.polish).toBeGreaterThanOrEqual(baseAxes.polish); // the protection
  });

  it("Delay: hype cools, budget burns, the team recovers", () => {
    const before = tired(shipState());
    const after = applyDelay(before);
    expect(after.hypeCooled).toBe(SHIP_TUNING.DELAY_HYPE_COOLING);
    expect(after.extraBudget).toBeGreaterThan(0);
    expect(after.run.staff[0]!.burnout).toBeLessThan(before.run.staff[0]!.burnout);
    // Cooled hype lowers the expectation baseline at launch.
    const hot = launchGame(before, plan({ marketingHype: 80 }), ctx());
    const cooled = launchGame(after, plan({ marketingHype: 80 }), ctx());
    expect(cooled.reception.expectedQuality).toBeLessThan(hot.reception.expectedQuality);
  });

  it("levers combine", () => {
    const state = applyCutScope(applyDelay(applyPolishRound(shipState())));
    expect(state.delayedMilestones).toBe(2);
    expect(state.run.featuresCut).toBeGreaterThan(0);
    expect(state.hypeCooled).toBeGreaterThan(0);
  });
});

describe("launch context derivation", () => {
  it("window crowding reads the competitive calendar", () => {
    // STUB_MARKET has a rival launching 1985 Q4.
    expect(deriveWindowCrowding(STUB_MARKET, { year: 1985, quarter: 4 })).toBe("crowded");
    expect(deriveWindowCrowding(STUB_MARKET, { year: 1986, quarter: 1 })).toBe("normal");
    expect(deriveWindowCrowding(STUB_MARKET, { year: 1986, quarter: 3 })).toBe("clear");
  });

  it("platform fit averages catalog genre fits; trends blend for hybrids", () => {
    expect(derivePlatformFit(["strategy"], ["pc"])).toBeCloseTo(1.1);
    expect(derivePlatformFit(["strategy"], ["home-console"])).toBeCloseTo(0.9);
    expect(deriveGenreTrend(STUB_MARKET, ["rpg"])).toBe("rising");
    expect(deriveGenreTrend(STUB_MARKET, ["rpg", "shooter"])).toBe("neutral");
  });
});

describe("launch hands off to the review pipeline", () => {
  it("finalizes axes and Q on the game and returns the full reveal package", () => {
    const result = launchGame(shipState(), plan(), ctx());
    expect(result.game.q).toBeGreaterThan(0);
    expect(result.game.axes.gameplay).toBeGreaterThan(0);
    expect(result.game.marketingSpend).toBe(40);
    expect(result.reception.reviews).toHaveLength(OUTLETS.length);
    expect(result.reception.metascore).toBeGreaterThan(0);
    expect(result.userScore).toBeGreaterThan(0);
    expect(result.postMortem.summary.text.length).toBeGreaterThan(0);
    expect(result.receptionState.metascore).toBe(result.reception.metascore);
    expect(result.receptionState.userScore).toBeCloseTo(result.userScore);
  });

  it("shipping with more open bugs costs Polish and the user score", () => {
    const buggy = launchGame(shipState(), plan(), ctx());
    const patchedUp = launchGame(
      applyPolishRound(applyPolishRound(shipState())),
      plan(),
      ctx(),
    );
    expect(patchedUp.axes.polish).toBeGreaterThan(buggy.axes.polish);
    expect(patchedUp.userScore).toBeGreaterThan(buggy.userScore);
  });

  it("marketing raises expectations — the §6 double-edged sword", () => {
    const humble = launchGame(shipState(), plan({ marketingHype: 10 }), ctx());
    const hyped = launchGame(shipState(), plan({ marketingHype: 95 }), ctx());
    expect(hyped.reception.expectedQuality).toBeGreaterThan(humble.reception.expectedQuality);
    expect(hyped.reception.gap).toBeLessThan(humble.reception.gap);
    // Same game, bigger promises, worse critical landing.
    expect(hyped.reception.metascore).toBeLessThan(humble.reception.metascore);
  });

  it("estimateReception is a noise-free preview of the same pipeline", () => {
    const estimate = estimateReception(shipState(), plan(), ctx());
    const real = launchGame(shipState(), plan(), { ...ctx(), rng: () => 0.5 });
    expect(estimate.metascore).toBeCloseTo(real.reception.metascore);
    expect(estimate.userScore).toBeCloseTo(real.userScore);
  });
});
