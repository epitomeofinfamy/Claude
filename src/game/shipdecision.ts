/**
 * The Ship Decision and Launch — GDD §6 (loop beats 4–5).
 *
 * At content-complete the player faces the real dilemma, choosing among and
 * combining four levers, each with the §6 tradeoffs:
 *
 *   Polish round — Polish axis ↑, bugs ↓ · costs time (delay) and budget
 *   Crunch round — same work without the delay · morale ↓, burnout ↑, quit risk ↑
 *   Cut scope    — ships on time, bugs ↓ (less game to break), protects Polish
 *                  · Content ↓ ("felt unfinished")
 *   Delay        — team rests, a later window can be picked · budget ↑, hype cools
 *
 * Then launch: release window (→ TimingMod via calendar crowding), marketing
 * spend (→ the ExpectationMod baseline), price, platforms. launchGame()
 * finalizes the axes with the shipped bugs and hands off to the complete
 * review pipeline (§7): critics, user score, post-mortem, reception state.
 *
 * Pure throughout; rng injected (crunch quit rolls, launch review variance).
 */

import {
  type AxisScores,
  type Game,
  type Genre,
  type GenreWeights,
  type Market,
  type Outlet,
  type Platform,
  type ReleaseWindow,
  type ScopeTier,
  type TrendPhase,
} from "./types";
import { clamp } from "./quality";
import {
  MILESTONE_TUNING,
  effectiveStaffOutput,
  isProductionComplete,
  producerEfficiency,
  toProductionInputs,
  updateStaffMeters,
  type ProductionRunState,
} from "./milestones";
import { produceAxes } from "./production";
import {
  computeUserScore,
  reviewCritics,
  type CriticReception,
  type ReviewContext,
  type Rng,
  type WindowCrowding,
} from "./reviews";
import { generatePostMortem, type PostMortem } from "./postmortem";
import { createReceptionState, type ReceptionState } from "./postlaunch";
import { PLATFORM_CATALOG } from "./data/platforms";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

export const SHIP_TUNING = {
  /** Baseline open bugs at content-complete, by ambition (§6). */
  BUGS_BY_TIER: { prototype: 25, indie: 35, "double-a": 45, aaa: 55 } as Record<
    ScopeTier,
    number
  >,
  /** Every crunched production milestone shipped a little extra breakage. */
  BUGS_PER_CRUNCHED_MILESTONE: 3,
  /** How much a fully-served Polish workstream prevented up front. */
  BUG_PREVENTION_FROM_POLISH: 30,

  /** Effort-points of bug-fixing per bug: capacity / this = bugs fixed. */
  CAPACITY_PER_BUG_FIXED: 30,
  /** Per-staff cost of a working round (polish/delay) and of crunch overtime. */
  ROUND_COST_PER_STAFF: 2_000,
  CRUNCH_COST_PER_STAFF: 1_000,
  /** Delay cools the marketing hype already built (§6). */
  DELAY_HYPE_COOLING: 8,

  /** Cut scope: features out, fewer bugs, schedule relief (§6). */
  CUT_FEATURES: 15,
  CUT_BUG_RELIEF: 8,
  CUT_SCHEDULE_RELIEF: 5,

  /** Shipped bugs enter §7.3 as the shippedBugs corner-cut, 1:1. */
  MARKETING_COST_PER_POINT: 200,
} as const;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface ShipDecisionState {
  run: ProductionRunState;
  /** Open-bug meter, 0–100; becomes the shippedBugs corner-cut at launch. */
  remainingBugs: number;
  /** Working rounds spent since content-complete (the visible slip). */
  delayedMilestones: number;
  /** Money burned on rounds and overtime since content-complete. */
  extraBudget: number;
  /** Hype lost to delays; subtracted from marketing at launch. */
  hypeCooled: number;
}

/** Enter the Ship Decision; requires content-complete production. */
export function createShipDecisionState(run: ProductionRunState): ShipDecisionState {
  if (!isProductionComplete(run)) {
    throw new Error("The Ship Decision starts at content-complete");
  }
  const t = SHIP_TUNING;
  const demand = MILESTONE_TUNING.SCOPE_DEMAND_PER_WORKSTREAM[run.scopeTier];
  const polishServed = clamp(run.progress.polish / demand, 0, 1);
  const remainingBugs = clamp(
    t.BUGS_BY_TIER[run.scopeTier] +
      t.BUGS_PER_CRUNCHED_MILESTONE * run.crunchedMilestones -
      t.BUG_PREVENTION_FROM_POLISH * polishServed,
    0,
    100,
  );
  return { run, remainingBugs, delayedMilestones: 0, extraBudget: 0, hypeCooled: 0 };
}

// ---------------------------------------------------------------------------
// The four levers (§6) — combinable, each returns a new state
// ---------------------------------------------------------------------------

function teamCapacity(run: ProductionRunState, crunching: boolean): number {
  return (
    run.staff.reduce((s, m) => s + effectiveStaffOutput(m), 0) *
    producerEfficiency(run.staff) *
    (crunching ? MILESTONE_TUNING.CRUNCH_OUTPUT_BOOST : 1)
  );
}

function fixBugs(bugs: number, capacity: number): number {
  return clamp(bugs - capacity / SHIP_TUNING.CAPACITY_PER_BUG_FIXED, 0, 100);
}

/** Polish: everyone on stability. Bugs ↓, Polish ↑ — and the release slips. */
export function applyPolishRound(state: ShipDecisionState): ShipDecisionState {
  const capacity = teamCapacity(state.run, false);
  const run: ProductionRunState = {
    ...state.run,
    progress: { ...state.run.progress, polish: state.run.progress.polish + capacity },
    staff: state.run.staff.map((s) => updateStaffMeters(s, false)),
  };
  return {
    ...state,
    run,
    remainingBugs: fixBugs(state.remainingBugs, capacity),
    delayedMilestones: state.delayedMilestones + 1,
    extraBudget: state.extraBudget + SHIP_TUNING.ROUND_COST_PER_STAFF * run.staff.length,
  };
}

/** Crunch: the same work without the slip — the team pays for it (§6). */
export function applyCrunchRound(state: ShipDecisionState, rng: Rng): ShipDecisionState {
  const t = MILESTONE_TUNING;
  const capacity = teamCapacity(state.run, true);

  // Meters move, then the burned-out roll to quit (same order as production).
  let staff = state.run.staff.map((s) => updateStaffMeters(s, true));
  const departedStaff = [...state.run.departedStaff];
  staff = staff.filter((member) => {
    if (member.burnout >= t.BURNOUT_THRESHOLD) {
      const chance =
        t.QUIT_CHANCE_AT_MAX_BURNOUT *
        ((member.burnout - t.BURNOUT_THRESHOLD) / (100 - t.BURNOUT_THRESHOLD));
      if (rng() < chance) {
        departedStaff.push(member.name);
        return false;
      }
    }
    return true;
  });

  const run: ProductionRunState = {
    ...state.run,
    progress: { ...state.run.progress, polish: state.run.progress.polish + capacity },
    staff,
    departedStaff,
    crunchedMilestones: state.run.crunchedMilestones + 1,
  };
  return {
    ...state,
    run,
    remainingBugs: fixBugs(state.remainingBugs, capacity),
    extraBudget: state.extraBudget + SHIP_TUNING.CRUNCH_COST_PER_STAFF * run.staff.length,
  };
}

/** Cut scope: ship on time and protect Polish; the Content axis pays (§6). */
export function applyCutScope(state: ShipDecisionState): ShipDecisionState {
  const t = SHIP_TUNING;
  return {
    ...state,
    run: {
      ...state.run,
      featuresCut: state.run.featuresCut + t.CUT_FEATURES,
      schedulePressure: Math.max(0, state.run.schedulePressure - t.CUT_SCHEDULE_RELIEF),
    },
    remainingBugs: clamp(state.remainingBugs - t.CUT_BUG_RELIEF, 0, 100),
  };
}

/** Delay: the team rests and a later window opens up — hype cools (§6). */
export function applyDelay(state: ShipDecisionState): ShipDecisionState {
  return {
    ...state,
    run: {
      ...state.run,
      staff: state.run.staff.map((s) => updateStaffMeters(s, false)),
    },
    delayedMilestones: state.delayedMilestones + 1,
    hypeCooled: state.hypeCooled + SHIP_TUNING.DELAY_HYPE_COOLING,
    extraBudget:
      state.extraBudget + SHIP_TUNING.ROUND_COST_PER_STAFF * state.run.staff.length,
  };
}

// ---------------------------------------------------------------------------
// The launch step (§6 → §7)
// ---------------------------------------------------------------------------

export interface LaunchPlan {
  releaseWindow: ReleaseWindow;
  /** Marketing spend normalized 0–100; sets the ExpectationMod baseline. */
  marketingHype: number;
  /** Price positioning 0–100 (50 = standard). */
  price: number;
  platforms: Platform[];
}

/** Calendar crowding for a window: rival in the same quarter = crowded (§7.6). */
export function deriveWindowCrowding(market: Market, window: ReleaseWindow): WindowCrowding {
  const slot = window.year * 4 + window.quarter;
  const distances = market.competitorCalendar.map((c) =>
    Math.abs(c.releaseWindow.year * 4 + c.releaseWindow.quarter - slot),
  );
  if (distances.includes(0)) return "crowded";
  if (distances.includes(1)) return "normal";
  return "clear";
}

/** Mean platform fit across chosen platforms and genres (→ PlatformFitMod). */
export function derivePlatformFit(genres: Genre[], platforms: Platform[]): number {
  if (platforms.length === 0 || genres.length === 0) return 1;
  let sum = 0;
  for (const platform of platforms) {
    for (const genre of genres) {
      sum += PLATFORM_CATALOG[platform].genreFit[genre] ?? 1;
    }
  }
  return sum / (platforms.length * genres.length);
}

const PHASE_VALUE: Record<TrendPhase, number> = { rising: 1, neutral: 0, fatigued: -1 };

/** Blended trend phase for a (possibly hybrid) concept's genres. */
export function deriveGenreTrend(market: Market, genres: Genre[]): TrendPhase {
  if (genres.length === 0) return "neutral";
  const mean = genres.reduce((s, g) => s + PHASE_VALUE[market.genreTrend[g]], 0) / genres.length;
  return mean > 0.5 ? "rising" : mean < -0.5 ? "fatigued" : "neutral";
}

export interface LaunchContext {
  game: Game;
  genreProfile: GenreWeights;
  market: Market;
  outlets: Outlet[];
  engineTechLevel: number;
  /** Deliberate creative risk carried through production (§7.2); 0–100. */
  riskTaking: number;
  reputation: number;
  /** Franchise pedigree if this is a sequel; 0 otherwise. */
  sequelPedigree: number;
  rng: Rng;
}

export interface LaunchResult {
  /** The game with finalized axes, Q, marketing, window, platforms. */
  game: Game;
  axes: AxisScores;
  q: number;
  context: ReviewContext;
  reception: CriticReception;
  userScore: number;
  postMortem: PostMortem;
  /** Live §7.9 state, ready for the post-launch loop. */
  receptionState: ReceptionState;
}

/** Finalize the axes with the shipped bugs and run the whole §7 pipeline. */
export function launchGame(
  state: ShipDecisionState,
  plan: LaunchPlan,
  ctx: LaunchContext,
): LaunchResult {
  const inputs = toProductionInputs(state.run, {
    riskTaking: ctx.riskTaking,
    engineTechLevel: ctx.engineTechLevel,
  });
  inputs.cutCorners = { ...inputs.cutCorners, shippedBugs: state.remainingBugs };
  const { axes, q } = produceAxes(inputs, ctx.genreProfile);

  const expectation = {
    marketingHype: clamp(plan.marketingHype - state.hypeCooled, 0, 100),
    scopeTier: state.run.scopeTier,
    reputation: ctx.reputation,
    sequelPedigree: ctx.sequelPedigree,
  };
  const context: ReviewContext = {
    genreTrend: deriveGenreTrend(ctx.market, ctx.game.genres),
    topicTrend: ctx.market.topicTrend[ctx.game.topic],
    windowCrowding: deriveWindowCrowding(ctx.market, plan.releaseWindow),
    platformFit: derivePlatformFit(ctx.game.genres, plan.platforms),
    isSequel: ctx.game.isSequelOf !== undefined,
  };

  const reception = reviewCritics({ axes, q, expectation, context }, ctx.outlets, ctx.rng);
  const userScore = computeUserScore({
    axes,
    q,
    gap: reception.gap,
    price: plan.price,
    sentiment: 50,
  });
  const postMortem = generatePostMortem({
    axes,
    q,
    genreProfile: ctx.genreProfile,
    reception,
    userScore,
    context,
    scopePressure: inputs.scopePressure,
    cutCorners: inputs.cutCorners,
    price: plan.price,
  });
  const receptionState = createReceptionState({
    axes,
    q,
    genreProfile: ctx.genreProfile,
    expectation,
    context,
    gap: reception.gap,
    metascore: reception.metascore,
    price: plan.price,
  });

  return {
    game: {
      ...ctx.game,
      axes,
      q,
      marketingSpend: plan.marketingHype,
      releaseWindow: plan.releaseWindow,
      platforms: [...plan.platforms],
    },
    axes,
    q,
    context,
    reception,
    userScore,
    postMortem,
    receptionState,
  };
}

/** Noise-free preview of the launch outcome for the §6 screen's estimates. */
export function estimateReception(
  state: ShipDecisionState,
  plan: LaunchPlan,
  ctx: Omit<LaunchContext, "rng">,
): { axes: AxisScores; q: number; metascore: number; userScore: number } {
  const result = launchGame(state, plan, { ...ctx, rng: () => 0.5 });
  return {
    axes: result.axes,
    q: result.q,
    metascore: result.reception.metascore,
    userScore: result.userScore,
  };
}
