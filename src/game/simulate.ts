/**
 * The playtest harness — auto-plays whole campaigns through the real loop
 * machine with distinct strategies, to check the anti-solve goals:
 *
 *   §7.11: no single memorized strategy should dominate a campaign.
 *   §12:   prestige (chase critics) and commercial (chase users/sales)
 *          must both be viable, distinct paths; failure must be reachable.
 *
 * Five strategies with different philosophies make randomized-but-themed
 * choices at every beat (concept, funding, allocation, events, ship levers,
 * launch plan, reinvestment). Everything runs on a seeded RNG, so a cohort
 * is fully reproducible. Nothing here touches the UI or storage — it drives
 * the same pure transitions the game does.
 */

import {
  advanceProduction,
  advanceReveal,
  beginProduction,
  completePostMortem,
  createLoop,
  enterShipDecision,
  finishReveal,
  greenlightConcept,
  investInEngine,
  isRevealComplete,
  launch,
  resolveEvent,
  resolveStudioEvent,
  setAllocation,
  setCrunch,
  shipCrunch,
  shipCutScope,
  shipPolish,
  startNextProject,
  trainTeam,
  upgradeOffice,
  type LoopState,
  type StudioState,
} from "./loop";
import { allowedScopeTiers, startingResearch } from "./progression";
import { publisherOffer } from "./economy";
import { blendGenreProfiles, type ConceptDraft } from "./conception";
import { deriveWindowCrowding, type LaunchPlan } from "./shipdecision";
import { toMarketView, upcomingWindows } from "./market";
import { isProductionComplete } from "./milestones";
import { WORKSTREAMS, type Genre, type Specialty, type Staff, type Workstream } from "./types";
import type { ProductionEvent } from "./milestones";
import type { Rng } from "./reviews";

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32) — cohorts are reproducible
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

export type StrategyId = "random" | "prestige" | "commercial" | "hype-machine" | "crunch-lord";

export const STRATEGIES: StrategyId[] = [
  "random",
  "prestige",
  "commercial",
  "hype-machine",
  "crunch-lord",
];

/** The same garage every strategy starts from (mirrors the game's opening). */
function seedStudio(): StudioState {
  const founder = (id: string, name: string, specialty: Specialty, skill: number): Staff => ({
    id,
    name,
    specialty,
    skills: {
      designer: 20,
      programmer: 20,
      artist: 15,
      audio: 10,
      writer: 15,
      producer: 15,
      qa: 20,
      [specialty]: skill,
    },
    morale: 80,
    burnout: 10,
  });
  return {
    name: "Sim Games",
    cash: 65_000,
    reputation: 0,
    year: 1985,
    ipCatalog: [],
    staff: [
      founder("f1", "A", "designer", 65),
      founder("f2", "B", "programmer", 60),
      founder("f3", "C", "artist", 60),
      founder("f4", "D", "writer", 55),
    ],
    engines: [{ id: "engine-1", name: "HomeBrew", techLevel: 25 }],
    offices: "garage",
    research: startingResearch(),
  };
}

function hottestResearchedGenre(s: LoopState): Genre {
  return s.studio.research.genres.reduce((best, g) =>
    s.market.genreHype[g].level > s.market.genreHype[best].level ? g : best,
  );
}

function pickConcept(strategy: StrategyId, s: LoopState, rng: Rng, index: number): ConceptDraft {
  const research = s.studio.research;
  const scopes = allowedScopeTiers(s.studio.offices).filter((t) => t !== "prototype");
  const scope = s.studio.cash > 55_000 && scopes.length > 0 ? scopes[0]! : "prototype";

  let genres: Genre[];
  let basis: ConceptDraft["basis"] = { kind: "new-ip" };
  switch (strategy) {
    case "prestige": // variety and hybrid experiments — chase Innovation
      genres =
        rng() < 0.5 && research.genres.length >= 2
          ? [research.genres[0]!, research.genres[1]!]
          : [pick(research.genres, rng)];
      break;
    case "commercial": {
      // Milk the franchise when one exists; otherwise chase the hottest trend.
      const bestIp = [...s.studio.ipCatalog].sort((a, b) => b.pedigree - a.pedigree)[0];
      if (bestIp) {
        basis = { kind: "sequel", ipId: bestIp.id };
        genres = bestIp.genres.filter((g) => research.genres.includes(g));
        if (genres.length === 0) genres = [pick(research.genres, rng)];
      } else {
        genres = [hottestResearchedGenre(s)];
      }
      break;
    }
    case "hype-machine":
      genres = [hottestResearchedGenre(s)];
      break;
    default:
      genres =
        rng() < 0.3 && research.genres.length >= 2
          ? [pick(research.genres, rng), pick(research.genres, rng)]
          : [pick(research.genres, rng)];
      if (genres.length === 2 && genres[0] === genres[1]) genres = [genres[0]!];
  }

  return {
    title: `${strategy} ${index + 1}`,
    basis,
    genres,
    topic: pick(research.topics, rng),
    platforms: [...research.platforms],
    scopeTier: scope,
  };
}

function riskFor(strategy: StrategyId, rng: Rng): number {
  switch (strategy) {
    case "prestige":
      return 85;
    case "commercial":
      return 35; // safe, but not so timid that sequels rot from iteration fatigue
    case "random":
      return Math.round(rng() * 100);
    default:
      return 50;
  }
}

function allocationFor(
  strategy: StrategyId,
  draft: ConceptDraft,
  rng: Rng,
): Record<Workstream, number> {
  if (strategy === "random") {
    const alloc = {} as Record<Workstream, number>;
    for (const ws of WORKSTREAMS) alloc[ws] = Math.round(rng() * 30);
    return alloc;
  }
  // Shape effort to the genre profile (§4), the craftsman's baseline.
  const w = blendGenreProfiles(draft.genres);
  return {
    gameplay: Math.round(w.gameplay * 10),
    content: Math.round(w.content * 10),
    tech: 10,
    art: Math.round(w.presentation * 6),
    audio: Math.round(w.presentation * 4),
    narrative: Math.round(w.narrative * 10),
    polish: Math.round(w.polish * 10) + (strategy === "commercial" ? 6 : 0),
  };
}

function pickEventOption(strategy: StrategyId, event: ProductionEvent, rng: Rng): string {
  const table: Record<StrategyId, Record<string, string>> = {
    prestige: {
      "design-breakthrough": "integrate",
      "poaching-attempt": "counter-offer",
      "feature-creep": "push-through",
    },
    commercial: {
      "design-breakthrough": "ship-safe",
      "poaching-attempt": "counter-offer",
      "feature-creep": "cut-feature",
    },
    "hype-machine": {
      "design-breakthrough": "ship-safe",
      "poaching-attempt": "let-ride",
      "feature-creep": "cut-feature",
    },
    "crunch-lord": {
      "design-breakthrough": "integrate",
      "poaching-attempt": "let-ride",
      "feature-creep": "push-through",
    },
    random: {},
  };
  return table[strategy][event.id] ?? pick(event.options, rng).id;
}

/** Ship-decision lever policy; returns the state at the moment of launch. */
function applyShipPolicy(strategy: StrategyId, s: LoopState, rng: Rng): LoopState {
  const rounds = (n: number, lever: (x: LoopState) => LoopState) => {
    for (let i = 0; i < n && s.phase === "ship"; i++) s = lever(s);
  };
  switch (strategy) {
    case "prestige": // polish until it shines, schedule be damned
      while (s.phase === "ship" && s.ship!.remainingBugs > 12 && s.ship!.delayedMilestones < 3) {
        s = shipPolish(s, rng);
      }
      break;
    case "commercial": // §7.8's polished derivative: users forgive safe, not buggy
      while (s.phase === "ship" && s.ship!.remainingBugs > 18 && s.ship!.delayedMilestones < 2) {
        s = shipPolish(s, rng);
      }
      break;
    case "hype-machine": // cut whatever's in the way and hit the date
      rounds(1, shipCutScope);
      break;
    case "crunch-lord": // fix it without slipping — the team pays
      rounds(2, (x) => shipCrunch(x, rng));
      break;
    case "random": {
      const n = Math.floor(rng() * 3);
      for (let i = 0; i < n && s.phase === "ship"; i++) {
        const lever = pick(
          [shipCutScope, (x: LoopState) => shipPolish(x, rng), (x: LoopState) => shipCrunch(x, rng)],
          rng,
        );
        s = lever(s);
      }
    }
  }
  return s;
}

function planFor(strategy: StrategyId, s: LoopState, rng: Rng): LaunchPlan {
  const windows = upcomingWindows(s.market, 6);
  const view = toMarketView(s.market);
  const window =
    strategy === "random"
      ? pick(windows, rng)
      : (windows.find((w) => deriveWindowCrowding(view, w) === "clear") ?? windows[windows.length - 1]!);
  const marketing =
    strategy === "prestige"
      ? 15
      : strategy === "commercial"
        ? 55
        : strategy === "hype-machine"
          ? 95
          : strategy === "crunch-lord"
            ? 50
            : Math.round(rng() * 100);
  const price = strategy === "commercial" ? 60 : strategy === "prestige" ? 45 : 50;
  return { releaseWindow: window, marketingHype: marketing, price, platforms: [...s.studio.research.platforms] };
}

/** The same modest reinvestment rules for everyone — strategy is the variable. */
function reinvest(s: LoopState): LoopState {
  const attempt = (fn: (x: LoopState) => LoopState) => {
    try {
      s = fn(s);
    } catch {
      // Can't afford it / at a ceiling — fine.
    }
  };
  if (s.studio.cash > 90_000) attempt(upgradeOffice);
  if (s.studio.cash > 50_000) attempt(investInEngine);
  if (s.studio.cash > 35_000) attempt(trainTeam);
  return s;
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export interface ProjectOutcome {
  metascore: number;
  userScore: number;
  q: number;
  gap: number;
  revenue: number;
}

export interface CampaignResult {
  strategy: StrategyId;
  seed: number;
  outcomes: ProjectOutcome[];
  bankrupt: boolean;
  finalCash: number;
  finalReputation: number;
}

export function simulateCampaign(
  strategy: StrategyId,
  seed: number,
  projects: number,
): CampaignResult {
  const rng = mulberry32(seed);
  let s = createLoop(seedStudio());
  const outcomes: ProjectOutcome[] = [];

  for (let p = 0; p < projects && s.phase === "conceive"; p++) {
    const draft = pickConcept(strategy, s, rng, p);
    s = greenlightConcept(s, draft);

    const wantsPublisher =
      (strategy === "commercial" || strategy === "hype-machine") &&
      publisherOffer(s.studio.reputation, draft.scopeTier!) !== null;
    s = beginProduction(s, {
      engineId: s.studio.engines[0]!.id,
      riskTaking: riskFor(strategy, rng),
      funding: wantsPublisher ? "publisher" : "self",
    });

    const allocation = allocationFor(strategy, draft, rng);
    for (const ws of WORKSTREAMS) s = setAllocation(s, ws, allocation[ws]);
    s = setCrunch(s, strategy === "crunch-lord");

    while (s.phase === "production" && s.run && !isProductionComplete(s.run)) {
      if (s.run.pendingEvent) {
        s = resolveEvent(s, pickEventOption(strategy, s.run.pendingEvent, rng), rng);
        continue;
      }
      s = advanceProduction(s, rng);
    }
    if (s.phase !== "production") break; // bankrupted mid-build

    s = enterShipDecision(s);
    s = applyShipPolicy(strategy, s, rng);
    if (s.phase !== "ship") break; // a polish slip's payroll finished us

    s = launch(s, planFor(strategy, s, rng), rng);
    while (s.reveal && !isRevealComplete(s.reveal)) s = advanceReveal(s);
    s = finishReveal(s);
    s = completePostMortem(s, rng);

    outcomes.push({
      metascore: s.launch!.reception.metascore,
      userScore: s.launch!.userScore,
      q: s.launch!.q,
      gap: s.launch!.reception.gap,
      revenue: s.growth!.revenue,
    });
    if (s.phase !== "grow") break; // the launch debt came due

    if (s.studioEvent) s = resolveStudioEvent(s, s.studioEvent.options[0]!.id);
    if (s.phase !== "grow") break;
    s = reinvest(s);
    if (p < projects - 1) s = startNextProject(s);
  }

  return {
    strategy,
    seed,
    outcomes,
    bankrupt: s.phase === "bankrupt",
    finalCash: s.studio.cash + s.pendingRevenue.reduce((a, b) => a + b, 0),
    finalReputation: s.studio.reputation,
  };
}

export function runCohort(
  strategy: StrategyId,
  campaigns: number,
  projects: number,
  baseSeed = 1,
): CampaignResult[] {
  const results: CampaignResult[] = [];
  for (let i = 0; i < campaigns; i++) {
    results.push(simulateCampaign(strategy, baseSeed + i * 7919, projects));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Aggregation & report
// ---------------------------------------------------------------------------

export interface StrategyStats {
  strategy: StrategyId;
  campaigns: number;
  projectsShipped: number;
  meta: { mean: number; p10: number; p50: number; p90: number; sd: number };
  user: { mean: number; p50: number };
  meanGap: number;
  meanRevenue: number;
  bankruptcyRate: number;
  meanFinalCash: number;
  meanFinalReputation: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export function summarize(results: CampaignResult[]): StrategyStats {
  const outcomes = results.flatMap((r) => r.outcomes);
  const metas = outcomes.map((o) => o.metascore).sort((a, b) => a - b);
  const users = outcomes.map((o) => o.userScore).sort((a, b) => a - b);
  const m = mean(metas);
  return {
    strategy: results[0]!.strategy,
    campaigns: results.length,
    projectsShipped: outcomes.length,
    meta: {
      mean: m,
      p10: percentile(metas, 10),
      p50: percentile(metas, 50),
      p90: percentile(metas, 90),
      sd: Math.sqrt(mean(metas.map((v) => (v - m) ** 2))),
    },
    user: { mean: mean(users), p50: percentile(users, 50) },
    meanGap: mean(outcomes.map((o) => o.gap)),
    meanRevenue: mean(outcomes.map((o) => o.revenue)),
    bankruptcyRate: mean(results.map((r) => (r.bankrupt ? 1 : 0))),
    meanFinalCash: mean(results.map((r) => r.finalCash)),
    meanFinalReputation: mean(results.map((r) => r.finalReputation)),
  };
}

export function formatReport(stats: StrategyStats[]): string {
  const pad = (v: string | number, w: number) => String(v).padStart(w);
  const row = (s: StrategyStats) =>
    [
      s.strategy.padEnd(13),
      pad(s.projectsShipped, 6),
      pad(s.meta.mean.toFixed(1), 7),
      pad(`${s.meta.p10.toFixed(0)}/${s.meta.p50.toFixed(0)}/${s.meta.p90.toFixed(0)}`, 11),
      pad(s.meta.sd.toFixed(1), 5),
      pad(s.user.mean.toFixed(1), 7),
      pad(s.meanGap.toFixed(1), 6),
      pad(`$${Math.round(s.meanRevenue / 1000)}k`, 7),
      pad(`${(s.bankruptcyRate * 100).toFixed(0)}%`, 6),
      pad(`$${Math.round(s.meanFinalCash / 1000)}k`, 8),
      pad(s.meanFinalReputation.toFixed(0), 5),
    ].join(" ");
  return [
    "strategy       ships    meta  p10/50/90    sd    user    gap  rev/gm  bkrpt  endcash   rep",
    ...stats.map(row),
  ].join("\n");
}
