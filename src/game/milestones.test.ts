import { describe, expect, it } from "vitest";
import {
  MILESTONE_TUNING,
  advanceMilestone,
  createProductionRun,
  effectiveStaffOutput,
  eventChance,
  isProductionComplete,
  producerEfficiency,
  resolveProductionEvent,
  teamSkill,
  toProductionInputs,
  type ProductionRunState,
} from "./milestones";
import { produceAxes } from "./production";
import { blendGenreProfiles } from "./conception";
import type { Specialty, Staff, Workstream } from "./types";

/** Deterministic RNG: consumes the queue, then repeats 0.99 (nothing fires). */
function makeRng(values: number[] = []): () => number {
  const queue = [...values];
  return () => queue.shift() ?? 0.99;
}

function makeStaff(
  id: string,
  specialty: Specialty,
  skill: number,
  overrides: Partial<Staff> = {},
): Staff {
  const skills = {
    designer: 20,
    programmer: 20,
    artist: 20,
    audio: 20,
    writer: 20,
    producer: 20,
    qa: 20,
    [specialty]: skill,
  };
  return {
    id,
    name: `${specialty}-${id}`,
    specialty,
    skills,
    morale: 80,
    burnout: 10,
    ...overrides,
  };
}

/** A competent 4-person garage team. */
function garageTeam(): Staff[] {
  return [
    makeStaff("s1", "designer", 65),
    makeStaff("s2", "programmer", 60),
    makeStaff("s3", "artist", 70),
    makeStaff("s4", "writer", 55),
  ];
}

const rpgAllocation: Record<Workstream, number> = {
  gameplay: 15,
  content: 25,
  tech: 10,
  art: 10,
  audio: 5,
  narrative: 25,
  polish: 10,
};

function runToCompletion(run: ProductionRunState): ProductionRunState {
  let current = run;
  while (!isProductionComplete(current)) {
    current = advanceMilestone(current, makeRng()).run;
  }
  return current;
}

describe("staff output (§5)", () => {
  it("morale scales output; burnout past the threshold tanks it", () => {
    const fresh = makeStaff("a", "designer", 60, { morale: 100, burnout: 0 });
    const gloomy = makeStaff("b", "designer", 60, { morale: 20, burnout: 0 });
    const torched = makeStaff("c", "designer", 60, { morale: 100, burnout: 95 });
    expect(effectiveStaffOutput(fresh)).toBeGreaterThan(effectiveStaffOutput(gloomy));
    expect(effectiveStaffOutput(torched)).toBeLessThan(effectiveStaffOutput(fresh) * 0.7);
    // Below the threshold, burnout doesn't bite yet.
    const tired = makeStaff("d", "designer", 60, { morale: 100, burnout: 60 });
    expect(effectiveStaffOutput(tired)).toBeCloseTo(effectiveStaffOutput(fresh));
  });

  it("specialists carry their workstream; a missing specialty falls back to generalists", () => {
    const team = garageTeam();
    expect(teamSkill(team, "gameplay")).toBe(65); // the designer
    expect(teamSkill(team, "audio")).toBe(20); // nobody — generalist average
    expect(teamSkill([], "audio")).toBe(0);
  });

  it("producers raise efficiency and dampen events", () => {
    const withProducer = [...garageTeam(), makeStaff("p", "producer", 80)];
    expect(producerEfficiency(withProducer)).toBeGreaterThan(producerEfficiency(garageTeam()));
    expect(eventChance(withProducer)).toBeLessThan(eventChance(garageTeam()));
  });
});

describe("milestone progression", () => {
  it("a full indie run serves the allocated workstreams and starves the ignored ones", () => {
    const run = runToCompletion(createProductionRun("indie", garageTeam(), rpgAllocation));
    expect(run.milestoneIndex).toBe(5);
    expect(isProductionComplete(run)).toBe(true);

    const inputs = toProductionInputs(run, { riskTaking: 60, engineTechLevel: 60 });
    expect(inputs.workstreams.content.effort).toBeGreaterThan(90);
    expect(inputs.workstreams.narrative.effort).toBeGreaterThan(90);
    expect(inputs.workstreams.audio.effort).toBeLessThan(50);
    // And the run feeds §7.3 end to end into a plausible game.
    const { q, axes } = produceAxes(inputs, blendGenreProfiles(["rpg"]));
    expect(q).toBeGreaterThan(50);
    expect(axes.narrative).toBeGreaterThan(axes.presentation); // writer served, audio starved
  });

  it("advancing past content-complete or over a pending event throws", () => {
    const done = runToCompletion(createProductionRun("prototype", garageTeam()));
    expect(() => advanceMilestone(done, makeRng())).toThrow(/content-complete/);

    const { run: interrupted } = advanceMilestone(
      createProductionRun("indie", garageTeam()),
      makeRng([0.01, 0.0]), // event fires, picks design-breakthrough
    );
    expect(interrupted.pendingEvent).not.toBeNull();
    expect(() => advanceMilestone(interrupted, makeRng())).toThrow(/pending/);
  });

  it("does not mutate the input run", () => {
    const run = createProductionRun("indie", garageTeam(), rpgAllocation);
    const snapshot = structuredClone(run);
    advanceMilestone(run, makeRng());
    expect(run).toEqual(snapshot);
  });
});

describe("crunch (§5, §6)", () => {
  it("boosts output but costs morale and accumulates burnout", () => {
    const base = createProductionRun("indie", garageTeam(), rpgAllocation);
    const rested = advanceMilestone(base, makeRng()).run;
    const crunched = advanceMilestone({ ...base, crunching: true }, makeRng()).run;

    const total = (r: ProductionRunState) =>
      Object.values(r.progress).reduce((s, v) => s + v, 0);
    expect(total(crunched)).toBeCloseTo(total(rested) * MILESTONE_TUNING.CRUNCH_OUTPUT_BOOST);
    expect(crunched.staff[0]!.burnout).toBe(10 + MILESTONE_TUNING.CRUNCH_BURNOUT_GAIN);
    expect(crunched.staff[0]!.morale).toBe(80 - MILESTONE_TUNING.CRUNCH_MORALE_COST);
    // Rest recovers instead.
    expect(rested.staff[0]!.burnout).toBe(10 - MILESTONE_TUNING.REST_BURNOUT_RECOVERY);
    expect(crunched.crunchedMilestones).toBe(1);
  });

  it("crunched milestones flow into the §7.3 crunch corner-cut", () => {
    let run = createProductionRun("prototype", garageTeam());
    run = { ...advanceMilestone({ ...run, crunching: true }, makeRng()).run, crunching: true };
    run = { ...advanceMilestone(run, makeRng()).run, crunching: false };
    run = advanceMilestone(run, makeRng()).run;
    const inputs = toProductionInputs(run, { riskTaking: 50, engineTechLevel: 50 });
    expect(inputs.cutCorners.crunch).toBeCloseTo((2 / 3) * 100);
  });

  it("a burned-out staffer can quit — and takes their output with them", () => {
    const exhausted = makeStaff("x", "artist", 70, { burnout: 85 });
    const run = createProductionRun("indie", [...garageTeam(), exhausted]);
    // After rest recovery (85→80) still over threshold; quit roll 0.01 fires.
    const { run: after, notices } = advanceMilestone(run, makeRng([0.01]));
    expect(after.staff.map((s) => s.id)).not.toContain("x");
    expect(after.departedStaff).toContain("artist-x");
    expect(notices.some((n) => n.kind === "quit")).toBe(true);
  });
});

describe("production events (§5)", () => {
  function interrupt(pick: number): ProductionRunState {
    const { run } = advanceMilestone(
      createProductionRun("indie", garageTeam(), rpgAllocation),
      makeRng([0.01, pick]),
    );
    return run;
  }

  it("a design breakthrough can be integrated (Gameplay ↑, schedule ↓) or shipped safe", () => {
    const run = interrupt(0.0);
    expect(run.pendingEvent!.id).toBe("design-breakthrough");

    const integrated = resolveProductionEvent(run, "integrate", makeRng()).run;
    expect(integrated.progress.gameplay).toBe(
      run.progress.gameplay + MILESTONE_TUNING.BREAKTHROUGH_GAMEPLAY_BONUS,
    );
    expect(integrated.schedulePressure).toBe(MILESTONE_TUNING.BREAKTHROUGH_SCHEDULE_COST);
    expect(integrated.pendingEvent).toBeNull();

    const safe = resolveProductionEvent(run, "ship-safe", makeRng()).run;
    const designer = safe.staff.find((s) => s.specialty === "designer")!;
    expect(designer.morale).toBeLessThan(run.staff.find((s) => s.specialty === "designer")!.morale);
  });

  it("a poaching attempt targets the top specialist; counter-offer costs cash and keeps them", () => {
    const run = interrupt(0.34); // index 1
    expect(run.pendingEvent!.id).toBe("poaching-attempt");
    expect(run.pendingEvent!.targetStaffId).toBe("s3"); // the 70-skill artist

    const countered = resolveProductionEvent(run, "counter-offer", makeRng()).run;
    expect(countered.cashSpent).toBe(MILESTONE_TUNING.POACH_COUNTER_COST);
    expect(countered.staff.map((s) => s.id)).toContain("s3");
    expect(countered.staff.find((s) => s.id === "s3")!.morale).toBeGreaterThan(
      run.staff.find((s) => s.id === "s3")!.morale,
    );
  });

  it("refusing to bid risks the hire — rng decides", () => {
    const run = interrupt(0.34);
    const lost = resolveProductionEvent(run, "let-ride", makeRng([0.2])).run;
    expect(lost.staff.map((s) => s.id)).not.toContain("s3");
    expect(lost.departedStaff).toContain("artist-s3");

    const kept = resolveProductionEvent(run, "let-ride", makeRng([0.9])).run;
    expect(kept.staff.map((s) => s.id)).toContain("s3");
    expect(kept.staff.find((s) => s.id === "s3")!.morale).toBeLessThan(80);
  });

  it("a ballooning feature is cut (scope ↓) or pushed through (schedule ↓, burnout ↑)", () => {
    const run = interrupt(0.9); // index 2
    expect(run.pendingEvent!.id).toBe("feature-creep");

    const cut = resolveProductionEvent(run, "cut-feature", makeRng()).run;
    expect(cut.featuresCut).toBe(MILESTONE_TUNING.CREEP_FEATURES_CUT);
    const cutInputs = toProductionInputs(cut, { riskTaking: 50, engineTechLevel: 50 });
    expect(cutInputs.cutCorners.featuresCut).toBe(MILESTONE_TUNING.CREEP_FEATURES_CUT);

    const pushed = resolveProductionEvent(run, "push-through", makeRng()).run;
    expect(pushed.schedulePressure).toBe(MILESTONE_TUNING.CREEP_SCHEDULE_COST);
    for (const [i, member] of pushed.staff.entries()) {
      expect(member.burnout).toBe(run.staff[i]!.burnout + MILESTONE_TUNING.CREEP_BURNOUT_COST);
    }
  });

  it("rejects resolving with no event or an unknown option", () => {
    const idle = createProductionRun("indie", garageTeam());
    expect(() => resolveProductionEvent(idle, "integrate", makeRng())).toThrow(/No pending/);
    const run = interrupt(0.0);
    expect(() => resolveProductionEvent(run, "counter-offer", makeRng())).toThrow(/Unknown option/);
  });
});

describe("scope pressure (§7.3 handoff)", () => {
  it("a small team on a huge project is over-scoped; a right-sized one is not", () => {
    const pair = [makeStaff("a", "designer", 60), makeStaff("b", "programmer", 60)];
    const aaa = toProductionInputs(createProductionRun("aaa", pair), {
      riskTaking: 50,
      engineTechLevel: 50,
    });
    const indie = toProductionInputs(createProductionRun("indie", pair), {
      riskTaking: 50,
      engineTechLevel: 50,
    });
    const comfy = toProductionInputs(createProductionRun("indie", garageTeam()), {
      riskTaking: 50,
      engineTechLevel: 50,
    });
    expect(aaa.scopePressure).toBeGreaterThan(indie.scopePressure);
    expect(indie.scopePressure).toBeGreaterThan(0);
    expect(comfy.scopePressure).toBe(0);
  });

  it("mid-production schedule damage adds to the pressure", () => {
    const run = { ...createProductionRun("indie", garageTeam()), schedulePressure: 18 };
    const inputs = toProductionInputs(run, { riskTaking: 50, engineTechLevel: 50 });
    expect(inputs.scopePressure).toBe(18);
  });
});
