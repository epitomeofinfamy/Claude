/**
 * Game conception — GDD §4 (loop beat 1, §3: Conceive).
 *
 * The player picks new IP or a sequel, one or two genres (hybrids blend two
 * axis profiles into a merged target — a deliberate anti-solve lever, §7.9),
 * a topic, target platform(s), and a scope/budget tier. Market research buys
 * a *partial* signal about trend fit — direction, never certainty (§4).
 *
 * Everything here is pure; the output of greenlightGame() is a configured
 * Game object ready for pre-production/production.
 */

import type {
  Game,
  Genre,
  GenreWeights,
  Ip,
  Market,
  Platform,
  ReleaseWindow,
  ScopeTier,
  Topic,
  TrendPhase,
} from "./types";
import { QUALITY_AXES } from "./types";
import { GENRE_PROFILES } from "./data/genres";

// ---------------------------------------------------------------------------
// Hybrid genre blending (§4)
// ---------------------------------------------------------------------------

/**
 * The ideal axis profile for a concept: one genre's profile as-is, or a
 * hybrid's two profiles averaged per axis into a merged target that no
 * single memorized combo satisfies (§4, §7.9 anti-solve).
 */
export function blendGenreProfiles(genres: Genre[]): GenreWeights {
  if (genres.length < 1 || genres.length > 2) {
    throw new Error("A concept takes one genre, or two for a hybrid");
  }
  if (genres.length === 2 && genres[0] === genres[1]) {
    throw new Error("A hybrid must blend two different genres");
  }
  const profiles = genres.map((g) => GENRE_PROFILES[g]);
  const blended = {} as GenreWeights;
  for (const axis of QUALITY_AXES) {
    blended[axis] = profiles.reduce((s, p) => s + p[axis], 0) / profiles.length;
  }
  return blended;
}

// ---------------------------------------------------------------------------
// The concept draft and its validation
// ---------------------------------------------------------------------------

export type ConceptBasis = { kind: "new-ip" } | { kind: "sequel"; ipId: string };

/** The player's in-progress choices; null = not yet chosen. */
export interface ConceptDraft {
  title: string;
  basis: ConceptBasis;
  genres: Genre[];
  topic: Topic | null;
  platforms: Platform[];
  scopeTier: ScopeTier | null;
}

export const EMPTY_DRAFT: ConceptDraft = {
  title: "",
  basis: { kind: "new-ip" },
  genres: [],
  topic: null,
  platforms: [],
  scopeTier: null,
};

/** Returns the list of problems blocking greenlight; empty = ready. */
export function validateConcept(draft: ConceptDraft, ipCatalog: Ip[]): string[] {
  const problems: string[] = [];
  if (draft.title.trim().length === 0) problems.push("Give the project a title.");
  if (draft.genres.length === 0) problems.push("Pick a genre.");
  if (draft.genres.length > 2) problems.push("Pick at most two genres.");
  if (draft.genres.length === 2 && draft.genres[0] === draft.genres[1]) {
    problems.push("A hybrid must blend two different genres.");
  }
  if (draft.topic === null) problems.push("Pick a topic.");
  if (draft.platforms.length === 0) problems.push("Pick at least one platform.");
  if (draft.scopeTier === null) problems.push("Pick a scope tier.");
  if (draft.basis.kind === "sequel") {
    const ipId = draft.basis.ipId;
    if (!ipCatalog.some((ip) => ip.id === ipId)) {
      problems.push("A sequel needs an existing IP from the catalog.");
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Market research: a partial trend-fit signal (§4)
// ---------------------------------------------------------------------------

export interface TrendReading {
  /** What was researched, e.g. "RPG (genre)" or "Fantasy (topic)". */
  subject: string;
  phase: TrendPhase;
  comment: string;
}

export interface TrendFitSignal {
  readings: TrendReading[];
  overall: "hot" | "warm" | "cool";
}

const TREND_COMMENTS: Record<TrendPhase, string> = {
  rising: "Interest is climbing — a window is open.",
  neutral: "Steady audience, no tailwind.",
  fatigued: "The market feels saturated right now.",
};

const PHASE_VALUE: Record<TrendPhase, number> = { rising: 1, neutral: 0, fatigued: -1 };

/**
 * What market research can tell you about a concept's trend fit: direction
 * per genre/topic, and a rough overall temperature. Deliberately partial —
 * no magnitudes, no timing, no certainty (§4). Reads a Market snapshot;
 * until the Phase 3 market sim lands, callers feed it STUB_MARKET.
 */
export function researchTrendFit(
  genres: Genre[],
  topic: Topic,
  market: Market,
): TrendFitSignal {
  const readings: TrendReading[] = [
    ...genres.map((genre) => {
      const phase = market.genreTrend[genre];
      return {
        subject: `${genre} (genre)`,
        phase,
        comment: TREND_COMMENTS[phase],
      };
    }),
    {
      subject: `${topic} (topic)`,
      phase: market.topicTrend[topic],
      comment: TREND_COMMENTS[market.topicTrend[topic]],
    },
  ];
  const mean =
    readings.reduce((s, r) => s + PHASE_VALUE[r.phase], 0) / readings.length;
  const overall = mean > 0.3 ? "hot" : mean < -0.3 ? "cool" : "warm";
  return { readings, overall };
}

// ---------------------------------------------------------------------------
// Greenlight: produce the configured Game (§3 beat 1 → beat 2)
// ---------------------------------------------------------------------------

/** Identifiers and slots the concept itself doesn't decide. */
export interface GreenlightContext {
  gameId: string;
  /** Used as the game's ipId when the concept is a new IP. */
  newIpId: string;
  /** Engine is a pre-production decision (§3 beat 2); a default slot for now. */
  engineId: string;
  releaseWindow: ReleaseWindow;
  ipCatalog: Ip[];
}

/**
 * Turns a valid draft into a configured Game object ready for production:
 * axes and Q start at zero (nothing is built yet), marketing at zero.
 * Throws if the draft doesn't validate.
 */
export function greenlightGame(draft: ConceptDraft, ctx: GreenlightContext): Game {
  const problems = validateConcept(draft, ctx.ipCatalog);
  if (problems.length > 0) {
    throw new Error(`Concept not ready to greenlight: ${problems.join(" ")}`);
  }
  const basis = draft.basis;
  const sequelIp =
    basis.kind === "sequel" ? ctx.ipCatalog.find((ip) => ip.id === basis.ipId)! : null;
  return {
    id: ctx.gameId,
    title: draft.title.trim(),
    ipId: sequelIp ? sequelIp.id : ctx.newIpId,
    genres: [...draft.genres],
    topic: draft.topic!,
    platforms: [...draft.platforms],
    scopeTier: draft.scopeTier!,
    engineId: ctx.engineId,
    axes: {
      gameplay: 0,
      content: 0,
      presentation: 0,
      narrative: 0,
      innovation: 0,
      polish: 0,
    },
    q: 0,
    marketingSpend: 0,
    releaseWindow: ctx.releaseWindow,
    ...(sequelIp && sequelIp.entries.length > 0
      ? { isSequelOf: sequelIp.entries[sequelIp.entries.length - 1] }
      : {}),
  };
}
