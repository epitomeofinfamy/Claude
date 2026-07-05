/**
 * Milestone-based production — GDD §5 (loop beat 3).
 *
 * Production runs as a sequence of milestones. Each milestone the player
 * distributes team effort across the seven workstreams; the team's output
 * (modified by morale, burnout, crunch, and producers) accumulates as
 * progress per workstream. At content-complete, toProductionInputs() turns
 * the run into the §7.3 axis-production inputs.
 *
 * Staff: per-specialty skills feed workstream skill; morale scales output;
 * burnout accumulates under crunch and, past BURNOUT_THRESHOLD, tanks output
 * and risks a quit. Producers raise milestone efficiency and dampen events.
 *
 * Production events (§5) interrupt with a pending decision; the run cannot
 * advance until the player resolves it.
 *
 * Everything is pure; randomness (event rolls, quit rolls) comes from an
 * injected RNG. RNG consumption order within advanceMilestone is fixed:
 * one quit roll per over-threshold staffer (team order), then the event
 * roll, then (if it fires) the event pick.
 */

import {
  WORKSTREAMS,
  type ScopeTier,
  type Specialty,
  type Staff,
  type Workstream,
} from "./types";
import { clamp } from "./quality";
import { getTuning } from "./config";
import type { ProductionInputs } from "./production";
import type { Rng } from "./reviews";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

export const MILESTONE_TUNING = {
  /** Milestones per scope tier — the schedule ambition sets (§4). */
  SCOPE_MILESTONES: { prototype: 3, indie: 5, "double-a": 8, aaa: 12 } as Record<
    ScopeTier,
    number
  >,
  /** Effort-points each workstream needs for "fully served" at this tier. */
  SCOPE_DEMAND_PER_WORKSTREAM: {
    prototype: 100,
    indie: 250,
    "double-a": 500,
    aaa: 900,
  } as Record<ScopeTier, number>,

  /** Effort-points one rested, content staffer produces per milestone. */
  OUTPUT_PER_MILESTONE: 100,
  /** Output share that survives at zero morale (§5: morale scales quality of output). */
  MORALE_OUTPUT_FLOOR: 0.7,
  /** Past this burnout, output tanks and quitting becomes a real risk (§5). */
  BURNOUT_THRESHOLD: 70,
  /** Output multiplier at maximum burnout (linear from the threshold down). */
  BURNOUT_OUTPUT_PENALTY: 0.5,
  QUIT_CHANCE_AT_MAX_BURNOUT: 0.35,

  // --- Crunch vs. rest, per milestone (§5, §6) ---
  CRUNCH_OUTPUT_BOOST: 1.3,
  CRUNCH_MORALE_COST: 6,
  CRUNCH_BURNOUT_GAIN: 12,
  REST_MORALE_RECOVERY: 2,
  REST_BURNOUT_RECOVERY: 5,

  // --- Producers (§5) ---
  PRODUCER_EFFICIENCY_PER_SKILL: 0.002,
  PRODUCER_EVENT_DAMPING_PER_SKILL: 0.004,

  // --- Production events (§5) ---
  EVENT_BASE_CHANCE: 0.35,
  BREAKTHROUGH_GAMEPLAY_BONUS: 120,
  BREAKTHROUGH_SCHEDULE_COST: 8,
  BREAKTHROUGH_MORALE_BUMP: 3,
  SAFE_VERSION_MORALE_COST: 3,
  POACH_COUNTER_COST: 5_000,
  POACH_COUNTER_MORALE_BUMP: 8,
  POACH_LOSS_CHANCE: 0.5,
  POACH_STAY_MORALE_COST: 5,
  CREEP_FEATURES_CUT: 15,
  CREEP_SCHEDULE_COST: 10,
  CREEP_BURNOUT_COST: 8,
  CREEP_MORALE_COST: 4,

  /** How sharply under-capacity ambition converts to §7.3 scope pressure. */
  SCOPE_PRESSURE_SCALE: 150,
} as const;

/** Which specialty carries each workstream (§5). */
export const WORKSTREAM_SPECIALTY: Record<Workstream, Specialty> = {
  gameplay: "designer",
  content: "designer",
  tech: "programmer",
  art: "artist",
  audio: "audio",
  narrative: "writer",
  polish: "qa",
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type ProductionEventId = "design-breakthrough" | "poaching-attempt" | "feature-creep";

export interface ProductionEvent {
  id: ProductionEventId;
  text: string;
  /** Present for events aimed at one person (poaching). */
  targetStaffId?: string;
  options: { id: string; label: string }[];
}

export interface ProductionNotice {
  kind: "quit" | "event" | "milestone" | "market";
  text: string;
}

export interface ProductionRunState {
  scopeTier: ScopeTier;
  milestoneIndex: number;
  totalMilestones: number;
  /** Relative weights across workstreams; normalized when applying. */
  allocation: Record<Workstream, number>;
  /** Accumulated effort-points per workstream. */
  progress: Record<Workstream, number>;
  staff: Staff[];
  crunching: boolean;
  crunchedMilestones: number;
  /** Extra §7.3 scope pressure accrued from mid-production decisions. */
  schedulePressure: number;
  /** Accumulated §7.3 cut-corner input from scope cuts. */
  featuresCut: number;
  /** Money burned on mid-production decisions (counter-offers). */
  cashSpent: number;
  pendingEvent: ProductionEvent | null;
  /** Names of everyone who walked out mid-project. */
  departedStaff: string[];
}

export const EVEN_ALLOCATION: Record<Workstream, number> = {
  gameplay: 14,
  content: 15,
  tech: 14,
  art: 15,
  audio: 14,
  narrative: 14,
  polish: 14,
};

export function createProductionRun(
  scopeTier: ScopeTier,
  staff: Staff[],
  allocation: Record<Workstream, number> = EVEN_ALLOCATION,
): ProductionRunState {
  return {
    scopeTier,
    milestoneIndex: 0,
    totalMilestones: MILESTONE_TUNING.SCOPE_MILESTONES[scopeTier],
    allocation: { ...allocation },
    progress: {
      gameplay: 0,
      content: 0,
      tech: 0,
      art: 0,
      audio: 0,
      narrative: 0,
      polish: 0,
    },
    staff: staff.map((s) => ({ ...s, skills: { ...s.skills } })),
    crunching: false,
    crunchedMilestones: 0,
    schedulePressure: 0,
    featuresCut: 0,
    cashSpent: 0,
    pendingEvent: null,
    departedStaff: [],
  };
}

export function isProductionComplete(run: ProductionRunState): boolean {
  return run.milestoneIndex >= run.totalMilestones && run.pendingEvent === null;
}

// ---------------------------------------------------------------------------
// Staff output (§5)
// ---------------------------------------------------------------------------

/** One staffer's effort-points this milestone, after morale and burnout. */
export function effectiveStaffOutput(staff: Staff): number {
  const t = MILESTONE_TUNING;
  const moraleFactor =
    t.MORALE_OUTPUT_FLOOR + (1 - t.MORALE_OUTPUT_FLOOR) * (clamp(staff.morale, 0, 100) / 100);
  const burnout = clamp(staff.burnout, 0, 100);
  const burnoutFactor =
    burnout >= t.BURNOUT_THRESHOLD
      ? 1 -
        t.BURNOUT_OUTPUT_PENALTY *
          ((burnout - t.BURNOUT_THRESHOLD) / (100 - t.BURNOUT_THRESHOLD))
      : 1;
  return t.OUTPUT_PER_MILESTONE * moraleFactor * burnoutFactor;
}

function bestProducerSkill(staff: Staff[]): number {
  return staff.reduce((best, s) => Math.max(best, s.skills.producer), 0);
}

/** Producers improve milestone efficiency (§5). */
export function producerEfficiency(staff: Staff[]): number {
  return 1 + MILESTONE_TUNING.PRODUCER_EFFICIENCY_PER_SKILL * bestProducerSkill(staff);
}

/** Producers dampen the chaos of events (§5). */
export function eventChance(staff: Staff[]): number {
  return clamp(
    MILESTONE_TUNING.EVENT_BASE_CHANCE *
      (1 - MILESTONE_TUNING.PRODUCER_EVENT_DAMPING_PER_SKILL * bestProducerSkill(staff)),
    0,
    1,
  );
}

/**
 * Team skill for a workstream: the average of the matching specialists
 * (they carry the work); without one, the whole team's average in that
 * skill — generalists filling in (§5: a genius programmer is wasted on
 * narrative, and a missing writer shows).
 */
export function teamSkill(staff: Staff[], workstream: Workstream): number {
  if (staff.length === 0) return 0;
  const specialty = WORKSTREAM_SPECIALTY[workstream];
  const specialists = staff.filter((s) => s.specialty === specialty);
  const pool = specialists.length > 0 ? specialists : staff;
  return pool.reduce((s, member) => s + member.skills[specialty], 0) / pool.length;
}

// ---------------------------------------------------------------------------
// Advancing a milestone
// ---------------------------------------------------------------------------

const EVENT_ORDER: ProductionEventId[] = [
  "design-breakthrough",
  "poaching-attempt",
  "feature-creep",
];

/**
 * A poaching attempt aimed at the team's top specialist (§5, §8). Exported
 * so the market simulation's competitor raids can raise the same event.
 */
export function makePoachingEvent(staff: Staff[], rivalName = "A rival studio"): ProductionEvent {
  const target = staff.reduce((best, s) =>
    s.skills[s.specialty] > best.skills[best.specialty] ? s : best,
  );
  return {
    id: "poaching-attempt",
    text: `${rivalName} is poaching ${target.name}.`,
    targetStaffId: target.id,
    options: [
      { id: "counter-offer", label: "Counter-offer (costs cash, morale ↑)" },
      { id: "let-ride", label: "Refuse to bid — risk losing them" },
    ],
  };
}

function makeEvent(id: ProductionEventId, staff: Staff[]): ProductionEvent {
  switch (id) {
    case "design-breakthrough":
      return {
        id,
        text: "A designer had a breakthrough on the combat system.",
        options: [
          { id: "integrate", label: "Take the time to integrate it (Gameplay ↑, schedule ↓)" },
          { id: "ship-safe", label: "Ship the safe version" },
        ],
      };
    case "poaching-attempt":
      return makePoachingEvent(staff);
    case "feature-creep":
      return {
        id,
        text: "A flagship feature is ballooning past its estimate.",
        options: [
          { id: "cut-feature", label: "Cut it (scope ↓, ships on time)" },
          { id: "push-through", label: "Push through (schedule ↓, burnout ↑)" },
        ],
      };
  }
}

/** Crunch/rest meter movement, scaled by the config's morale rates. */
export function updateStaffMeters(staff: Staff, crunching: boolean): Staff {
  const t = MILESTONE_TUNING;
  const { crunchToll, recoveryRate } = getTuning();
  return crunching
    ? {
        ...staff,
        morale: clamp(staff.morale - t.CRUNCH_MORALE_COST * crunchToll, 0, 100),
        burnout: clamp(staff.burnout + t.CRUNCH_BURNOUT_GAIN * crunchToll, 0, 100),
      }
    : {
        ...staff,
        morale: clamp(staff.morale + t.REST_MORALE_RECOVERY * recoveryRate, 0, 100),
        burnout: clamp(staff.burnout - t.REST_BURNOUT_RECOVERY * recoveryRate, 0, 100),
      };
}

export interface MilestoneResult {
  run: ProductionRunState;
  notices: ProductionNotice[];
}

/**
 * Runs one milestone: applies the current allocation, updates every meter,
 * rolls quit risk for the burned-out, and maybe interrupts with an event.
 * Throws if an event is pending or production is already complete.
 */
export function advanceMilestone(run: ProductionRunState, rng: Rng): MilestoneResult {
  const t = MILESTONE_TUNING;
  if (run.pendingEvent) {
    throw new Error("Resolve the pending production event before advancing");
  }
  if (run.milestoneIndex >= run.totalMilestones) {
    throw new Error("Production is already content-complete");
  }

  const notices: ProductionNotice[] = [];

  // 1. Output for this milestone, with the meters as they stand.
  const capacity =
    run.staff.reduce((s, member) => s + effectiveStaffOutput(member), 0) *
    producerEfficiency(run.staff) *
    (run.crunching ? t.CRUNCH_OUTPUT_BOOST : 1);
  const totalWeight = WORKSTREAMS.reduce((s, ws) => s + Math.max(0, run.allocation[ws]), 0);
  const progress = { ...run.progress };
  if (totalWeight > 0) {
    for (const ws of WORKSTREAMS) {
      progress[ws] += capacity * (Math.max(0, run.allocation[ws]) / totalWeight);
    }
  }

  // 2. Morale/burnout move with the working conditions.
  let staff = run.staff.map((s) => updateStaffMeters(s, run.crunching));

  // 3. Quit rolls for everyone past the burnout threshold (§5).
  const staying: Staff[] = [];
  const departedStaff = [...run.departedStaff];
  for (const member of staff) {
    if (member.burnout >= t.BURNOUT_THRESHOLD) {
      const chance =
        t.QUIT_CHANCE_AT_MAX_BURNOUT *
        ((member.burnout - t.BURNOUT_THRESHOLD) / (100 - t.BURNOUT_THRESHOLD));
      if (rng() < chance) {
        departedStaff.push(member.name);
        notices.push({
          kind: "quit",
          text: `${member.name} burned out and quit.`,
        });
        continue;
      }
    }
    staying.push(member);
  }
  staff = staying;

  // 4. Maybe an event interrupts (dampened by producers, §5).
  let pendingEvent: ProductionEvent | null = null;
  if (staff.length > 0 && rng() < eventChance(staff)) {
    const pick = EVENT_ORDER[Math.min(EVENT_ORDER.length - 1, Math.floor(rng() * EVENT_ORDER.length))]!;
    pendingEvent = makeEvent(pick, staff);
    notices.push({ kind: "event", text: pendingEvent.text });
  }

  const milestoneIndex = run.milestoneIndex + 1;
  notices.push({
    kind: "milestone",
    text: `Milestone ${milestoneIndex}/${run.totalMilestones} complete.`,
  });

  return {
    run: {
      ...run,
      milestoneIndex,
      progress,
      staff,
      departedStaff,
      crunchedMilestones: run.crunchedMilestones + (run.crunching ? 1 : 0),
      pendingEvent,
    },
    notices,
  };
}

// ---------------------------------------------------------------------------
// Resolving events (§5)
// ---------------------------------------------------------------------------

export function resolveProductionEvent(
  run: ProductionRunState,
  optionId: string,
  rng: Rng,
): MilestoneResult {
  const t = MILESTONE_TUNING;
  const event = run.pendingEvent;
  if (!event) throw new Error("No pending production event");
  if (!event.options.some((o) => o.id === optionId)) {
    throw new Error(`Unknown option "${optionId}" for event "${event.id}"`);
  }
  const notices: ProductionNotice[] = [];
  let next: ProductionRunState = { ...run, pendingEvent: null };

  switch (event.id) {
    case "design-breakthrough":
      if (optionId === "integrate") {
        next = {
          ...next,
          progress: {
            ...next.progress,
            gameplay: next.progress.gameplay + t.BREAKTHROUGH_GAMEPLAY_BONUS,
          },
          schedulePressure: next.schedulePressure + t.BREAKTHROUGH_SCHEDULE_COST,
          staff: next.staff.map((s) => ({
            ...s,
            morale: clamp(s.morale + t.BREAKTHROUGH_MORALE_BUMP, 0, 100),
          })),
        };
        notices.push({ kind: "event", text: "The breakthrough is in — combat sings." });
      } else {
        next = {
          ...next,
          staff: next.staff.map((s) =>
            s.specialty === "designer"
              ? { ...s, morale: clamp(s.morale - t.SAFE_VERSION_MORALE_COST, 0, 100) }
              : s,
          ),
        };
        notices.push({ kind: "event", text: "Shipped the safe version. The designers sigh." });
      }
      break;

    case "poaching-attempt": {
      const target = next.staff.find((s) => s.id === event.targetStaffId);
      if (optionId === "counter-offer") {
        next = {
          ...next,
          cashSpent: next.cashSpent + t.POACH_COUNTER_COST,
          staff: next.staff.map((s) =>
            s.id === event.targetStaffId
              ? { ...s, morale: clamp(s.morale + t.POACH_COUNTER_MORALE_BUMP, 0, 100) }
              : s,
          ),
        };
        notices.push({
          kind: "event",
          text: `${target?.name ?? "They"} stays — the counter-offer worked.`,
        });
      } else if (target && rng() < t.POACH_LOSS_CHANCE) {
        next = {
          ...next,
          staff: next.staff.filter((s) => s.id !== target.id),
          departedStaff: [...next.departedStaff, target.name],
        };
        notices.push({ kind: "quit", text: `${target.name} took the rival's offer.` });
      } else if (target) {
        next = {
          ...next,
          staff: next.staff.map((s) =>
            s.id === target.id
              ? { ...s, morale: clamp(s.morale - t.POACH_STAY_MORALE_COST, 0, 100) }
              : s,
          ),
        };
        notices.push({
          kind: "event",
          text: `${target.name} stays, but noticed you didn't fight for them.`,
        });
      }
      break;
    }

    case "feature-creep":
      if (optionId === "cut-feature") {
        next = { ...next, featuresCut: next.featuresCut + t.CREEP_FEATURES_CUT };
        notices.push({ kind: "event", text: "Feature cut. The build slims down and ships." });
      } else {
        next = {
          ...next,
          schedulePressure: next.schedulePressure + t.CREEP_SCHEDULE_COST,
          staff: next.staff.map((s) => ({
            ...s,
            burnout: clamp(s.burnout + t.CREEP_BURNOUT_COST, 0, 100),
            morale: clamp(s.morale - t.CREEP_MORALE_COST, 0, 100),
          })),
        };
        notices.push({ kind: "event", text: "Pushing through. The team digs in — and wears down." });
      }
      break;
  }

  return { run: next, notices };
}

// ---------------------------------------------------------------------------
// Handing off to §7.3
// ---------------------------------------------------------------------------

/**
 * Converts the finished (or in-flight) run into §7.3 axis-production inputs.
 * Efforts are progress vs. the tier's per-workstream demand; skills are the
 * team's specialty averages; scope pressure combines the tier's ambition vs.
 * current headcount with mid-production schedule damage. shippedBugs stays 0
 * here — that number is decided at the Ship Decision (§6), not in production.
 */
export function toProductionInputs(
  run: ProductionRunState,
  opts: { riskTaking: number; engineTechLevel: number },
): ProductionInputs {
  const t = MILESTONE_TUNING;
  const demand = t.SCOPE_DEMAND_PER_WORKSTREAM[run.scopeTier];

  const workstreams = {} as ProductionInputs["workstreams"];
  for (const ws of WORKSTREAMS) {
    workstreams[ws] = {
      effort: clamp((run.progress[ws] / demand) * 100, 0, 100),
      skill: teamSkill(run.staff, ws),
    };
  }

  const nominalCapacity =
    run.staff.length * t.OUTPUT_PER_MILESTONE * run.totalMilestones;
  const demandTotal = demand * WORKSTREAMS.length;
  const ambitionPressure = clamp(
    t.SCOPE_PRESSURE_SCALE * (1 - nominalCapacity / demandTotal),
    0,
    100,
  );

  return {
    workstreams,
    riskTaking: clamp(opts.riskTaking, 0, 100),
    engineTechLevel: clamp(opts.engineTechLevel, 0, 100),
    scopePressure: clamp(ambitionPressure + run.schedulePressure, 0, 100),
    cutCorners: {
      featuresCut: clamp(run.featuresCut, 0, 100),
      shippedBugs: 0,
      crunch:
        run.totalMilestones > 0
          ? clamp((run.crunchedMilestones / run.totalMilestones) * 100, 0, 100)
          : 0,
    },
  };
}
