/**
 * The core loop as a state machine — GDD §3, the §16 MVP spine.
 *
 *   conceive → pre-production → production → ship → reception
 *            → post-mortem → grow → (back to conceive, one scale up)
 *
 * LoopState holds the full game state: the studio (the part that persists
 * across projects) plus the current project's stage data. Every transition
 * is a pure function that validates the current phase, applies the relevant
 * game-logic module, and returns a new state — the Zustand store in
 * src/state/ is a thin shell over this machine, which is what makes the
 * whole loop drivable end-to-end in tests.
 *
 * Reception is staggered per §3 beat 6: critic reviews roll in one at a
 * time, then the user score, then the Metascore — the reveal is a designed
 * dramatic beat, not a stat dump.
 */

import type { Engine, Game, Ip, Market, Outlet, Staff, Workstream } from "./types";
import { clamp } from "./quality";
import { greenlightGame, validateConcept, blendGenreProfiles, type ConceptDraft } from "./conception";
import {
  advanceMilestone,
  createProductionRun,
  isProductionComplete,
  makePoachingEvent,
  resolveProductionEvent,
  type ProductionNotice,
  type ProductionRunState,
} from "./milestones";
import {
  advanceMarketQuarter,
  createMarketSim,
  installBases,
  recordRelease,
  toMarketView,
  type MarketSimState,
} from "./market";
import {
  applyCrunchRound,
  applyCutScope,
  applyDelay,
  applyPolishRound,
  createShipDecisionState,
  launchGame,
  SHIP_TUNING,
  type LaunchPlan,
  type LaunchResult,
  type ShipDecisionState,
} from "./shipdecision";
import { computeSales, GROW_TUNING, reputationDelta, updateIpCatalog } from "./grow";
import { OUTLETS } from "./data/outlets";
import type { Rng } from "./reviews";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type LoopPhase =
  | "conceive"
  | "pre-production"
  | "production"
  | "ship"
  | "reception"
  | "post-mortem"
  | "grow";

/** Everything that persists across projects (§3 beat 8: the past compounds). */
export interface StudioState {
  name: string;
  cash: number;
  reputation: number;
  year: number;
  ipCatalog: Ip[];
  staff: Staff[];
  engines: Engine[];
}

/** The staggered reveal (§3 beat 6). */
export interface RevealState {
  totalReviews: number;
  reviewsRevealed: number;
  userScoreRevealed: boolean;
  metascoreRevealed: boolean;
}

export interface GrowthReport {
  units: number;
  revenue: number;
  reputationDelta: number;
  ip: Ip | null;
  notes: string[];
}

export interface LoopState {
  phase: LoopPhase;
  studio: StudioState;
  /** The living §8 market simulation; one production milestone = one quarter. */
  market: MarketSimState;
  /** Monotonic id source for games/IPs. */
  projectCounter: number;
  game: Game | null;
  /** Pre-production choice (§3 beat 2); feeds Innovation (§7.2). */
  riskTaking: number;
  run: ProductionRunState | null;
  ship: ShipDecisionState | null;
  launch: LaunchResult | null;
  reveal: RevealState | null;
  growth: GrowthReport | null;
  /** Notices from the most recent production action, for the UI. */
  lastNotices: ProductionNotice[];
}

export function createLoop(studio: StudioState, market: MarketSimState = createMarketSim()): LoopState {
  return {
    phase: "conceive",
    studio,
    market,
    projectCounter: 1,
    game: null,
    riskTaking: 50,
    run: null,
    ship: null,
    launch: null,
    reveal: null,
    growth: null,
    lastNotices: [],
  };
}

/**
 * One quarter of market time passes (production milestones and release
 * slips cost calendar time; crunch is how you dodge that). Market news
 * joins the notices; a rival raid is returned for the caller to stage.
 */
function tickMarket(
  state: LoopState,
  rng: Rng,
): { state: LoopState; poachRaidBy: string | null } {
  const tick = advanceMarketQuarter(state.market, rng);
  return {
    state: {
      ...state,
      market: tick.sim,
      studio: { ...state.studio, year: tick.sim.year },
      lastNotices: [
        ...state.lastNotices,
        ...tick.news.map((text) => ({ kind: "market" as const, text })),
      ],
    },
    poachRaidBy: tick.poachRaidBy,
  };
}

function expectPhase(state: LoopState, phase: LoopPhase): void {
  if (state.phase !== phase) {
    throw new Error(`Expected phase "${phase}", but the loop is in "${state.phase}"`);
  }
}

/** The engine this project builds on (chosen in pre-production). */
export function projectEngine(state: LoopState): Engine {
  const engine =
    state.studio.engines.find((e) => e.id === state.game?.engineId) ?? state.studio.engines[0];
  if (!engine) throw new Error("The studio has no engine");
  return engine;
}

// ---------------------------------------------------------------------------
// Beat 1 → 2: Conceive
// ---------------------------------------------------------------------------

export function greenlightConcept(state: LoopState, draft: ConceptDraft): LoopState {
  expectPhase(state, "conceive");
  const problems = validateConcept(draft, state.studio.ipCatalog);
  if (problems.length > 0) {
    throw new Error(`Concept not ready: ${problems.join(" ")}`);
  }
  const id = state.projectCounter;
  const game = greenlightGame(draft, {
    gameId: `game-${id}`,
    newIpId: `ip-${id}`,
    engineId: state.studio.engines[0]?.id ?? "",
    releaseWindow: { year: state.studio.year, quarter: 4 },
    ipCatalog: state.studio.ipCatalog,
  });
  return { ...state, phase: "pre-production", projectCounter: id + 1, game };
}

// ---------------------------------------------------------------------------
// Beat 2 → 3: Pre-production
// ---------------------------------------------------------------------------

export interface PreProductionChoices {
  engineId: string;
  /** Deliberate creative risk, 0–100 — the Innovation feed (§7.2). */
  riskTaking: number;
}

export function beginProduction(state: LoopState, choices: PreProductionChoices): LoopState {
  expectPhase(state, "pre-production");
  if (!state.game) throw new Error("No greenlit game");
  if (!state.studio.engines.some((e) => e.id === choices.engineId)) {
    throw new Error(`Unknown engine "${choices.engineId}"`);
  }
  return {
    ...state,
    phase: "production",
    game: { ...state.game, engineId: choices.engineId },
    riskTaking: clamp(choices.riskTaking, 0, 100),
    run: createProductionRun(state.game.scopeTier, state.studio.staff),
  };
}

// ---------------------------------------------------------------------------
// Beat 3: Production
// ---------------------------------------------------------------------------

export function setAllocation(state: LoopState, workstream: Workstream, value: number): LoopState {
  expectPhase(state, "production");
  if (!state.run) throw new Error("No production run");
  return {
    ...state,
    run: { ...state.run, allocation: { ...state.run.allocation, [workstream]: value } },
  };
}

export function setCrunch(state: LoopState, crunching: boolean): LoopState {
  expectPhase(state, "production");
  if (!state.run) throw new Error("No production run");
  return { ...state, run: { ...state.run, crunching } };
}

export function advanceProduction(state: LoopState, rng: Rng): LoopState {
  expectPhase(state, "production");
  if (!state.run) throw new Error("No production run");
  const { run, notices } = advanceMilestone(state.run, rng);
  const ticked = tickMarket({ ...state, run, lastNotices: notices }, rng);
  let next = ticked.state;
  // A rival raid from the market becomes a §5 poaching event, if the
  // milestone didn't already interrupt with something.
  if (ticked.poachRaidBy && next.run && !next.run.pendingEvent && next.run.staff.length > 0) {
    const event = makePoachingEvent(next.run.staff, ticked.poachRaidBy);
    next = {
      ...next,
      run: { ...next.run, pendingEvent: event },
      lastNotices: [...next.lastNotices, { kind: "event", text: event.text }],
    };
  }
  return next;
}

export function resolveEvent(state: LoopState, optionId: string, rng: Rng): LoopState {
  expectPhase(state, "production");
  if (!state.run) throw new Error("No production run");
  const before = state.run.cashSpent;
  const { run, notices } = resolveProductionEvent(state.run, optionId, rng);
  const spent = run.cashSpent - before;
  return {
    ...state,
    run,
    lastNotices: notices,
    studio: { ...state.studio, cash: state.studio.cash - spent },
  };
}

// ---------------------------------------------------------------------------
// Beat 4: The Ship Decision
// ---------------------------------------------------------------------------

export function enterShipDecision(state: LoopState): LoopState {
  expectPhase(state, "production");
  if (!state.run || !isProductionComplete(state.run)) {
    throw new Error("Production is not content-complete");
  }
  return { ...state, phase: "ship", ship: createShipDecisionState(state.run), lastNotices: [] };
}

function applyShipLever(
  state: LoopState,
  lever: (s: ShipDecisionState) => ShipDecisionState,
): LoopState {
  expectPhase(state, "ship");
  if (!state.ship) throw new Error("Not at the Ship Decision");
  const next = lever(state.ship);
  const spent = next.extraBudget - state.ship.extraBudget;
  return { ...state, ship: next, studio: { ...state.studio, cash: state.studio.cash - spent } };
}

/** Polish rounds and delays slip the calendar — the market moves on (§6). */
export const shipPolish = (state: LoopState, rng: Rng = () => 0.5) =>
  tickMarket(applyShipLever({ ...state, lastNotices: [] }, applyPolishRound), rng).state;
export const shipDelay = (state: LoopState, rng: Rng = () => 0.5) =>
  tickMarket(applyShipLever({ ...state, lastNotices: [] }, applyDelay), rng).state;
/** Cutting scope and crunching are how you ship without losing the quarter. */
export const shipCutScope = (state: LoopState) => applyShipLever(state, applyCutScope);
export const shipCrunch = (state: LoopState, rng: Rng) =>
  applyShipLever(state, (s) => applyCrunchRound(s, rng));

// ---------------------------------------------------------------------------
// Beat 5 → 6: Launch, then the staggered reveal
// ---------------------------------------------------------------------------

export function launch(
  state: LoopState,
  plan: LaunchPlan,
  rng: Rng,
  outlets: Outlet[] = OUTLETS,
  marketOverride?: Market,
): LoopState {
  expectPhase(state, "ship");
  if (!state.game || !state.ship) throw new Error("Nothing to launch");
  const sequelIp = state.game.isSequelOf
    ? state.studio.ipCatalog.find((ip) => ip.id === state.game!.ipId)
    : undefined;
  const result = launchGame(state.ship, plan, {
    game: state.game,
    genreProfile: blendGenreProfiles(state.game.genres),
    market: marketOverride ?? toMarketView(state.market),
    outlets,
    engineTechLevel: projectEngine(state).techLevel,
    riskTaking: state.riskTaking,
    reputation: state.studio.reputation,
    sequelPedigree: sequelIp?.pedigree ?? 0,
    rng,
  });
  const marketingCost = plan.marketingHype * SHIP_TUNING.MARKETING_COST_PER_POINT;
  return {
    ...state,
    phase: "reception",
    game: result.game,
    launch: result,
    // The market absorbs your release too — flood a genre and it fatigues (§8).
    market: recordRelease(state.market, result.game.genres),
    studio: { ...state.studio, cash: state.studio.cash - marketingCost },
    reveal: {
      totalReviews: result.reception.reviews.length,
      reviewsRevealed: 0,
      userScoreRevealed: false,
      metascoreRevealed: false,
    },
  };
}

/** One beat of the reveal: next review → user score → Metascore (§3 beat 6). */
export function advanceReveal(state: LoopState): LoopState {
  expectPhase(state, "reception");
  const reveal = state.reveal;
  if (!reveal) throw new Error("Nothing to reveal");
  if (reveal.reviewsRevealed < reveal.totalReviews) {
    return { ...state, reveal: { ...reveal, reviewsRevealed: reveal.reviewsRevealed + 1 } };
  }
  if (!reveal.userScoreRevealed) {
    return { ...state, reveal: { ...reveal, userScoreRevealed: true } };
  }
  if (!reveal.metascoreRevealed) {
    return { ...state, reveal: { ...reveal, metascoreRevealed: true } };
  }
  throw new Error("The reveal is complete — move to the post-mortem");
}

export function isRevealComplete(reveal: RevealState): boolean {
  return (
    reveal.reviewsRevealed >= reveal.totalReviews &&
    reveal.userScoreRevealed &&
    reveal.metascoreRevealed
  );
}

/** Reveal done → sit with the post-mortem (§7.10). */
export function finishReveal(state: LoopState): LoopState {
  expectPhase(state, "reception");
  if (!state.reveal || !isRevealComplete(state.reveal)) {
    throw new Error("The reveal is still rolling in");
  }
  return { ...state, phase: "post-mortem" };
}

// ---------------------------------------------------------------------------
// Beat 7 → 8: Grow — the outcome compounds
// ---------------------------------------------------------------------------

export function completePostMortem(state: LoopState): LoopState {
  expectPhase(state, "post-mortem");
  const result = state.launch;
  if (!result || !state.game || !state.ship) throw new Error("No launch to grow from");
  const t = GROW_TUNING;

  const sales = computeSales({
    metascore: result.reception.metascore,
    userScore: result.userScore,
    marketingHype: result.game.marketingSpend,
    price: result.receptionState.price,
    platforms: result.game.platforms,
    installBases: installBases(state.market),
  });
  const repDelta = reputationDelta(result.reception.metascore, result.userScore);
  const ipUpdate = updateIpCatalog(
    state.studio.ipCatalog,
    result.game,
    result.reception.metascore,
    result.userScore,
  );

  const notes: string[] = [];
  if (ipUpdate.note) notes.push(ipUpdate.note);
  notes.push(
    repDelta >= 0
      ? "Reputation is climbing — and so is the bar you'll be held to."
      : "The industry noticed the stumble. Rebuild trust with the next one.",
  );

  // Downtime between projects heals the team (§5) — the survivors, that is.
  const staff = state.ship.run.staff.map((s) => ({
    ...s,
    morale: clamp(s.morale + t.POST_PROJECT_MORALE_RECOVERY, 0, 100),
    burnout: clamp(s.burnout - t.POST_PROJECT_BURNOUT_RECOVERY, 0, 100),
  }));

  return {
    ...state,
    phase: "grow",
    studio: {
      ...state.studio,
      cash: state.studio.cash + sales.revenue,
      reputation: clamp(state.studio.reputation + repDelta, 0, 100),
      year: Math.max(state.studio.year, result.game.releaseWindow.year),
      ipCatalog: ipUpdate.catalog,
      staff,
    },
    growth: {
      units: sales.units,
      revenue: sales.revenue,
      reputationDelta: repDelta,
      ip: ipUpdate.ip,
      notes,
    },
  };
}

/** Back to Conceive, at whatever scale the studio has grown to (§3). */
export function startNextProject(state: LoopState): LoopState {
  expectPhase(state, "grow");
  return {
    ...state,
    phase: "conceive",
    game: null,
    riskTaking: 50,
    run: null,
    ship: null,
    launch: null,
    reveal: null,
    growth: null,
    lastNotices: [],
  };
}
