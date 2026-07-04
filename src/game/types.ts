/**
 * Core domain types, following the data-object sketch in GOING_GOLD_GDD.md §15.
 * Everything in src/game/ is pure TypeScript — no React, no DOM, no side effects.
 *
 * Convention: "enums" are const string arrays + derived union types, so values
 * are iterable at runtime (for seed data and validation) and erase cleanly.
 */

// ---------------------------------------------------------------------------
// Quality axes (GDD §7.2)
// ---------------------------------------------------------------------------

/** The six quality axes every game is scored on (GDD §7.2). */
export const QUALITY_AXES = [
  "gameplay",
  "content",
  "presentation",
  "narrative",
  "innovation",
  "polish",
] as const;

export type QualityAxis = (typeof QUALITY_AXES)[number];

/** A 0–100 reading per axis, produced during production (GDD §7.3). */
export type AxisScores = Record<QualityAxis, number>;

/** Genre weights over the axes; normalized when computing Q (GDD §7.3). */
export type GenreWeights = Record<QualityAxis, number>;

// ---------------------------------------------------------------------------
// Enumerations (GDD §4, §5, §8, §10)
// ---------------------------------------------------------------------------

/** Sample genres from the GDD §4 ideal-axis-profile table. */
export const GENRES = [
  "rpg",
  "shooter",
  "puzzle",
  "strategy",
  "adventure",
  "simulation",
] as const;

export type Genre = (typeof GENRES)[number];

/** Topics/themes (GDD §4); unlocked via research in the full game. */
export const TOPICS = ["fantasy", "space", "crime", "sports", "horror"] as const;

export type Topic = (typeof TOPICS)[number];

export const PLATFORMS = ["pc", "home-console"] as const;

export type Platform = (typeof PLATFORMS)[number];

/** Scope/budget tiers: ceiling, floor, and expectations all scale (GDD §4). */
export const SCOPE_TIERS = ["prototype", "indie", "double-a", "aaa"] as const;

export type ScopeTier = (typeof SCOPE_TIERS)[number];

/** Production workstreams; each feeds one or more quality axes (GDD §5). */
export const WORKSTREAMS = [
  "gameplay",
  "content",
  "tech",
  "art",
  "audio",
  "narrative",
  "polish",
] as const;

export type Workstream = (typeof WORKSTREAMS)[number];

/** Staff specialties (GDD §5). */
export const SPECIALTIES = [
  "designer",
  "programmer",
  "artist",
  "audio",
  "writer",
  "producer",
  "qa",
] as const;

export type Specialty = (typeof SPECIALTIES)[number];

/** Studio growth stages, gating team size and project scope (GDD §10). */
export const OFFICE_TIERS = ["garage", "indie", "studio", "aaa"] as const;

export type OfficeTier = (typeof OFFICE_TIERS)[number];

/** Where a genre/topic sits on its hype curve, feeding TrendMod (GDD §7.6, §8). */
export const TREND_PHASES = ["rising", "neutral", "fatigued"] as const;

export type TrendPhase = (typeof TREND_PHASES)[number];

/** Platform lifecycle stages (GDD §8). */
export const LIFECYCLE_STAGES = ["launch", "growth", "peak", "decline"] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

// ---------------------------------------------------------------------------
// Core data objects (GDD §15)
// ---------------------------------------------------------------------------

/** A release window on the visible competitive calendar (GDD §6, §7.6). */
export interface ReleaseWindow {
  year: number;
  quarter: 1 | 2 | 3 | 4;
}

/** A game project — the central object of the loop (GDD §15). */
export interface Game {
  id: string;
  title: string;
  /** The IP this game belongs to; sequels share an ipId (GDD §10). */
  ipId: string;
  /** One entry = pure genre; two = hybrid with a blended profile (GDD §4). */
  genres: Genre[];
  topic: Topic;
  platforms: Platform[];
  scopeTier: ScopeTier;
  engineId: string;
  /** The six axis readings produced during production (GDD §7.3). */
  axes: AxisScores;
  /** Objective quality: genre-weighted axis sum, 0–100 (GDD §7.3). */
  q: number;
  marketingSpend: number;
  releaseWindow: ReleaseWindow;
  /** Game id of the prior entry, if this is a sequel (feeds SequelMod, §7.6). */
  isSequelOf?: string;
}

/** An engine; its tech level caps Presentation and Polish (GDD §7.3). */
export interface Engine {
  id: string;
  name: string;
  /** 0–100 ceiling factor for the Presentation/Polish axes. */
  techLevel: number;
}

/** A shippable IP/franchise in the studio's catalog (GDD §10). */
export interface Ip {
  id: string;
  name: string;
  genres: Genre[];
  topic: Topic;
  /** Franchise pedigree, 0–100 — raises expectations and sequel value (§7.6). */
  pedigree: number;
  /** Game ids of shipped entries, in order. */
  entries: string[];
}

/** A team member (GDD §5, §15). */
export interface Staff {
  id: string;
  name: string;
  specialty: Specialty;
  /** Per-specialty skill levels, 0–100; depth outside the specialty is rare. */
  skills: Record<Specialty, number>;
  /** Morale and burnout are two separate meters (GDD §5). */
  morale: number;
  burnout: number;
}

/** The player's studio (GDD §15). */
export interface Studio {
  name: string;
  cash: number;
  /** The compounding asset — opens doors and raises the bar (GDD §10). */
  reputation: number;
  engines: Engine[];
  staff: Staff[];
  ipCatalog: Ip[];
  offices: OfficeTier;
}

/** A critic outlet — a review "personality" (GDD §7.4, §15). */
export interface Outlet {
  id: string;
  name: string;
  /** What this outlet cares about; normalized when scoring (GDD §7.5). */
  axisWeights: Record<QualityAxis, number>;
  /** 0–1: how hard the outlet grades relative to peers. */
  harshness: number;
  /** 0–1: weight in the Metascore aggregate (GDD §7.7). */
  prestige: number;
  /** Bounded random spread in score points (±), scaled per outlet (GDD §7.5). */
  variance: number;
}

/** Static platform facts; dynamic state (lifecycle) lives in Market (GDD §4, §8). */
export interface PlatformInfo {
  id: Platform;
  name: string;
  audience: "hardcore" | "casual" | "broad";
  /** Initial install base in units; the market simulation evolves it (§8). */
  installBase: number;
  /** Genre fit multipliers feeding PlatformFitMod (§7.6); 1 = neutral. */
  genreFit: Partial<Record<Genre, number>>;
}

/** A rival launch on the visible competitive calendar (GDD §6, §8). */
export interface CompetitorLaunch {
  id: string;
  title: string;
  studioName: string;
  genres: Genre[];
  topic: Topic;
  platforms: Platform[];
  releaseWindow: ReleaseWindow;
}

/** The world the reviews live in (GDD §8, §15). */
export interface Market {
  genreTrend: Record<Genre, TrendPhase>;
  topicTrend: Record<Topic, TrendPhase>;
  platformLifecycle: Record<Platform, LifecycleStage>;
  /** 0–1 per genre: how flooded it is; erodes the trend bonus (GDD §8). */
  saturation: Record<Genre, number>;
  competitorCalendar: CompetitorLaunch[];
}
