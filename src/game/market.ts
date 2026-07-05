/**
 * The market simulation — GDD §8. The world the reviews live in.
 *
 * - Genre/topic hype curves: a level (0–100) with momentum that mean-reverts
 *   and drifts with noise, so trends rise, crest, and fall on their own
 *   cycles. The curve's momentum (and saturation) derive the TrendPhase
 *   that feeds TrendMod (§7.6).
 * - Genre saturation: every release into a genre (yours or a rival's)
 *   saturates it; saturation decays each quarter but past the bar it erodes
 *   the trend's bonus into fatigue — flooding a hot genre burns it out (§8).
 * - Platform lifecycles: age drives launch → growth → peak → decline, and
 *   the stage moves the install base every quarter.
 * - AI competitor studios announce games onto the visible calendar (feeding
 *   TimingMod via window crowding), ship them (adding saturation), and
 *   occasionally raid your team (surfacing as a poaching event).
 *
 * Time is quarterly. advanceMarketQuarter is pure with an injected RNG;
 * RNG consumption order per tick is fixed: one draw per genre curve (GENRES
 * order), one per topic curve (TOPICS order), then per-competitor announce
 * rolls (announce → topic → platform → lead → title parts), then the poach
 * roll. toMarketView() projects the sim into the §15 Market shape the
 * review pipeline and conception research consume.
 */

import {
  GENRES,
  TOPICS,
  PLATFORMS,
  type CompetitorLaunch,
  type Genre,
  type LifecycleStage,
  type Market,
  type Platform,
  type ReleaseWindow,
  type Topic,
  type TrendPhase,
} from "./types";
import { clamp } from "./quality";
import type { Rng } from "./reviews";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

export const MARKET_TUNING = {
  // --- Hype curves ---
  /** Pull of the level back toward 50 per quarter (sets cycle length). */
  HYPE_MEAN_PULL: 0.08,
  /** Random momentum jitter per quarter (± this many points). */
  HYPE_NOISE: 3,
  MOMENTUM_CAP: 8,
  /** Momentum at or above this reads as a rising trend. */
  PHASE_RISING_MOMENTUM: 1.5,
  /** Momentum at or below this reads as fatigued. */
  PHASE_FATIGUED_MOMENTUM: -1.5,

  // --- Saturation (§8: you can burn out a trend by over-serving it) ---
  /** At or above this, a genre reads fatigued regardless of its curve. */
  SATURATION_FATIGUE_BAR: 0.55,
  /** Multiplicative decay per quarter. */
  SATURATION_DECAY: 0.85,
  /** Added per game shipped into the genre. */
  SATURATION_PER_RELEASE: 0.18,

  // --- Platform lifecycles (§8) ---
  /** Age boundaries in years: < launch → launch, < growth → growth, < peak → peak. */
  LIFECYCLE_YEARS: { launch: 1, growth: 3, peak: 7 },
  /** Quarterly install-base growth per stage. */
  LIFECYCLE_GROWTH: { launch: 0.1, growth: 0.06, peak: 0.01, decline: -0.04 } as Record<
    LifecycleStage,
    number
  >,

  // --- Competitors ---
  /** Chance per competitor per quarter to announce a game. */
  COMPETITOR_ANNOUNCE_CHANCE: 0.35,
  /** Chance per quarter that a rival makes a run at your staff. */
  COMPETITOR_POACH_CHANCE: 0.1,
  /** Shipped calendar entries linger this many quarters for window crowding. */
  CALENDAR_MEMORY_QUARTERS: 2,
} as const;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface HypeCurve {
  level: number;
  momentum: number;
}

export interface PlatformSimState {
  installBase: number;
  launchedYear: number;
}

export interface CompetitorStudio {
  id: string;
  name: string;
}

interface CalendarEntry {
  launch: CompetitorLaunch;
  shipped: boolean;
}

export interface MarketSimState {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  genreHype: Record<Genre, HypeCurve>;
  topicHype: Record<Topic, HypeCurve>;
  platforms: Record<Platform, PlatformSimState>;
  saturation: Record<Genre, number>;
  competitors: CompetitorStudio[];
  calendar: CalendarEntry[];
}

/** The 1985 starting market: RPGs and fantasy heating up, adventure flooded. */
export function createMarketSim(): MarketSimState {
  return {
    year: 1985,
    quarter: 3,
    genreHype: {
      rpg: { level: 55, momentum: 3 },
      shooter: { level: 50, momentum: 0.5 },
      puzzle: { level: 45, momentum: 0 },
      strategy: { level: 50, momentum: -0.5 },
      adventure: { level: 62, momentum: -2.5 },
      simulation: { level: 40, momentum: 1 },
    },
    topicHype: {
      fantasy: { level: 58, momentum: 3 },
      space: { level: 52, momentum: 0 },
      crime: { level: 45, momentum: 0.5 },
      sports: { level: 55, momentum: -2.5 },
      horror: { level: 45, momentum: 1 },
    },
    platforms: {
      pc: { installBase: 4_000_000, launchedYear: 1981 },
      "home-console": { installBase: 9_000_000, launchedYear: 1985 },
    },
    saturation: { rpg: 0.15, shooter: 0.25, puzzle: 0.1, strategy: 0.2, adventure: 0.65, simulation: 0.1 },
    competitors: [
      { id: "rival-macrofun", name: "Macrofun" },
      { id: "rival-pixelforge", name: "Pixel Forge" },
      { id: "rival-ironwood", name: "Ironwood Interactive" },
    ],
    calendar: [
      {
        launch: {
          id: "launch-macrofun-1985q4",
          title: "Star Raider II",
          studioName: "Macrofun",
          genres: ["shooter"],
          topic: "space",
          platforms: ["home-console"],
          releaseWindow: { year: 1985, quarter: 4 },
        },
        shipped: false,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

function quarterIndex(year: number, quarter: number): number {
  return year * 4 + quarter;
}

/** A genre's trend phase: its curve, unless saturation has burned it out (§8). */
export function genrePhase(sim: MarketSimState, genre: Genre): TrendPhase {
  const t = MARKET_TUNING;
  if (sim.saturation[genre] >= t.SATURATION_FATIGUE_BAR) return "fatigued";
  const { momentum } = sim.genreHype[genre];
  if (momentum >= t.PHASE_RISING_MOMENTUM) return "rising";
  if (momentum <= t.PHASE_FATIGUED_MOMENTUM) return "fatigued";
  return "neutral";
}

export function topicPhase(sim: MarketSimState, topic: Topic): TrendPhase {
  const t = MARKET_TUNING;
  const { momentum } = sim.topicHype[topic];
  if (momentum >= t.PHASE_RISING_MOMENTUM) return "rising";
  if (momentum <= t.PHASE_FATIGUED_MOMENTUM) return "fatigued";
  return "neutral";
}

/** Lifecycle stage from platform age (§8). */
export function platformStage(sim: MarketSimState, platform: Platform): LifecycleStage {
  const t = MARKET_TUNING.LIFECYCLE_YEARS;
  const age = sim.year + (sim.quarter - 1) / 4 - sim.platforms[platform].launchedYear;
  if (age < t.launch) return "launch";
  if (age < t.growth) return "growth";
  if (age < t.peak) return "peak";
  return "decline";
}

/** Projects the sim into the §15 Market view the rest of the game consumes. */
export function toMarketView(sim: MarketSimState): Market {
  const genreTrend = {} as Record<Genre, TrendPhase>;
  for (const genre of GENRES) genreTrend[genre] = genrePhase(sim, genre);
  const topicTrend = {} as Record<Topic, TrendPhase>;
  for (const topic of TOPICS) topicTrend[topic] = topicPhase(sim, topic);
  const platformLifecycle = {} as Record<Platform, LifecycleStage>;
  for (const platform of PLATFORMS) platformLifecycle[platform] = platformStage(sim, platform);
  return {
    genreTrend,
    topicTrend,
    platformLifecycle,
    saturation: { ...sim.saturation },
    competitorCalendar: sim.calendar.map((e) => e.launch),
  };
}

/** Current install bases, for sales (§8: lifecycles change the audience). */
export function installBases(sim: MarketSimState): Record<Platform, number> {
  const bases = {} as Record<Platform, number>;
  for (const platform of PLATFORMS) {
    bases[platform] = Math.round(sim.platforms[platform].installBase);
  }
  return bases;
}

/** The next `count` release windows, starting after the current quarter. */
export function upcomingWindows(sim: MarketSimState, count: number): ReleaseWindow[] {
  const windows: ReleaseWindow[] = [];
  let year = sim.year;
  let quarter = sim.quarter;
  for (let i = 0; i < count; i++) {
    quarter++;
    if (quarter > 4) {
      quarter = 1;
      year++;
    }
    windows.push({ year, quarter: quarter as ReleaseWindow["quarter"] });
  }
  return windows;
}

// ---------------------------------------------------------------------------
// Mutation: releases and the quarterly tick
// ---------------------------------------------------------------------------

/** An outside shove to a genre's hype momentum (viral moments, §11). */
export function bumpGenreHype(
  sim: MarketSimState,
  genre: Genre,
  momentum: number,
): MarketSimState {
  const curve = sim.genreHype[genre];
  return {
    ...sim,
    genreHype: {
      ...sim.genreHype,
      [genre]: {
        ...curve,
        momentum: clamp(
          curve.momentum + momentum,
          -MARKET_TUNING.MOMENTUM_CAP,
          MARKET_TUNING.MOMENTUM_CAP,
        ),
      },
    },
  };
}

/** A game shipped into these genres: the trend absorbs it (§8 saturation). */
export function recordRelease(sim: MarketSimState, genres: Genre[]): MarketSimState {
  const saturation = { ...sim.saturation };
  for (const genre of genres) {
    saturation[genre] = clamp(saturation[genre] + MARKET_TUNING.SATURATION_PER_RELEASE, 0, 1);
  }
  return { ...sim, saturation };
}

export interface MarketTick {
  sim: MarketSimState;
  news: string[];
  /** Name of the rival raiding your team this quarter, if any. */
  poachRaidBy: string | null;
}

function stepCurve(curve: HypeCurve, rng: Rng): HypeCurve {
  const t = MARKET_TUNING;
  const momentum = clamp(
    curve.momentum + (50 - curve.level) * t.HYPE_MEAN_PULL + (2 * rng() - 1) * t.HYPE_NOISE,
    -t.MOMENTUM_CAP,
    t.MOMENTUM_CAP,
  );
  return { level: clamp(curve.level + momentum, 0, 100), momentum };
}

const RIVAL_TITLE_FIRST = ["Star", "Iron", "Neon", "Shadow", "Turbo", "Crystal", "Mega"];
const RIVAL_TITLE_SECOND = ["Raider", "Quest", "Commander", "Legends", "Racer", "Vault", "Knights"];

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

/** Rivals chase whatever is hottest right now (§8: competitors occupy trends). */
function hottestGenre(sim: MarketSimState): Genre {
  return GENRES.reduce((best, genre) =>
    sim.genreHype[genre].level > sim.genreHype[best].level ? genre : best,
  );
}

/** One quarter of market motion. Pure; see the module doc for RNG order. */
export function advanceMarketQuarter(sim: MarketSimState, rng: Rng): MarketTick {
  const t = MARKET_TUNING;
  const news: string[] = [];

  // 1. Time moves.
  let year = sim.year;
  let quarter = sim.quarter + 1;
  if (quarter > 4) {
    quarter = 1;
    year++;
  }
  let next: MarketSimState = { ...sim, year, quarter: quarter as MarketSimState["quarter"] };

  // 2. Hype curves drift (genres, then topics).
  const genreHype = {} as Record<Genre, HypeCurve>;
  for (const genre of GENRES) genreHype[genre] = stepCurve(sim.genreHype[genre], rng);
  const topicHype = {} as Record<Topic, HypeCurve>;
  for (const topic of TOPICS) topicHype[topic] = stepCurve(sim.topicHype[topic], rng);

  // 3. Saturation cools; 4. platforms move with their lifecycle stage.
  const saturation = {} as Record<Genre, number>;
  for (const genre of GENRES) saturation[genre] = sim.saturation[genre] * t.SATURATION_DECAY;
  const platforms = {} as Record<Platform, PlatformSimState>;
  next = { ...next, genreHype, topicHype, saturation };
  for (const platform of PLATFORMS) {
    const stage = platformStage(next, platform);
    platforms[platform] = {
      ...sim.platforms[platform],
      installBase: Math.max(
        0,
        sim.platforms[platform].installBase * (1 + t.LIFECYCLE_GROWTH[stage]),
      ),
    };
  }
  next = { ...next, platforms };

  // 5. Due rival games ship: news, saturation, and they stay on the calendar
  //    (briefly) so their window still reads crowded.
  const nowIdx = quarterIndex(year, quarter);
  let calendar: CalendarEntry[] = [];
  for (const entry of next.calendar) {
    const dueIdx = quarterIndex(entry.launch.releaseWindow.year, entry.launch.releaseWindow.quarter);
    if (!entry.shipped && dueIdx <= nowIdx) {
      next = recordRelease(next, entry.launch.genres);
      news.push(`${entry.launch.studioName} shipped ${entry.launch.title}.`);
      calendar.push({ ...entry, shipped: true });
    } else {
      calendar.push(entry);
    }
  }
  calendar = calendar.filter(
    (e) =>
      quarterIndex(e.launch.releaseWindow.year, e.launch.releaseWindow.quarter) >=
      nowIdx - t.CALENDAR_MEMORY_QUARTERS,
  );

  // 6. Competitors announce new games onto the visible calendar.
  for (const competitor of next.competitors) {
    if (rng() < t.COMPETITOR_ANNOUNCE_CHANCE) {
      const genre = hottestGenre(next);
      const topic = pick(TOPICS, rng);
      const platform = pick(PLATFORMS, rng);
      const lead = rng() < 0.5 ? 1 : 2;
      const windows = upcomingWindows(next, lead);
      const window = windows[windows.length - 1]!;
      const title = `${pick(RIVAL_TITLE_FIRST, rng)} ${pick(RIVAL_TITLE_SECOND, rng)}`;
      calendar.push({
        launch: {
          id: `launch-${competitor.id}-${window.year}q${window.quarter}-${calendar.length}`,
          title,
          studioName: competitor.name,
          genres: [genre],
          topic,
          platforms: [platform],
          releaseWindow: window,
        },
        shipped: false,
      });
      news.push(
        `${competitor.name} announced ${title} (${genre}) for Q${window.quarter} ${window.year}.`,
      );
    }
  }

  // 7. Maybe a rival makes a run at your people (§8: competitors poach staff).
  let poachRaidBy: string | null = null;
  if (next.competitors.length > 0 && rng() < t.COMPETITOR_POACH_CHANCE) {
    poachRaidBy = pick(next.competitors, rng).name;
  }

  return { sim: { ...next, calendar }, news, poachRaidBy };
}
