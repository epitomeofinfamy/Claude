/**
 * Meta-progression — GDD §10.
 *
 * - Studio growth tiers (garage → indie → studio → AAA) gate team size,
 *   the engine's tech ceiling, and project scope. Upgrades cost cash and
 *   are gated by reputation.
 * - Research unlocks genres, topics, and platforms; engine features (the
 *   Presentation/Polish ceiling raiser, §7.3) are bought via engine R&D in
 *   the loop, capped by the office tier.
 * - Reputation is the compounding asset: it opens publishers (§9), better
 *   talent (hiring below), and franchise value — while raising the
 *   ExpectedQuality bar (§7.6). Being great is a treadmill, by design.
 * - Franchises/IP live in grow.ts (updateIpCatalog): a successful original
 *   becomes sequel-able with pedigree, feeding SequelMod and expectations.
 */

import {
  SCOPE_TIERS,
  GENRES,
  TOPICS,
  PLATFORMS,
  type Genre,
  type OfficeTier,
  type Platform,
  type ScopeTier,
  type Specialty,
  type Staff,
  type Topic,
} from "./types";
import { clamp } from "./quality";
import type { ConceptDraft } from "./conception";

export const PROGRESSION_TUNING = {
  /** Desks that fit in the office (§10: tiers gate team size). */
  MAX_STAFF: { garage: 4, indie: 8, studio: 16, aaa: 40 } as Record<OfficeTier, number>,
  /** How far engine R&D can push tech at this tier (§10: engine ceilings). */
  ENGINE_CEILING: { garage: 40, indie: 60, studio: 80, aaa: 100 } as Record<OfficeTier, number>,
  /** Project scopes the office can support (§10: gating project scope). */
  ALLOWED_SCOPE: {
    garage: ["prototype", "indie"],
    indie: ["prototype", "indie", "double-a"],
    studio: [...SCOPE_TIERS],
    aaa: [...SCOPE_TIERS],
  } as Record<OfficeTier, readonly ScopeTier[]>,
  /** The move up: cost plus the reputation that makes landlords call back. */
  OFFICE_UPGRADES: {
    garage: { to: "indie" as OfficeTier, cost: 30_000, reputationGate: 15 },
    indie: { to: "studio" as OfficeTier, cost: 100_000, reputationGate: 40 },
    studio: { to: "aaa" as OfficeTier, cost: 300_000, reputationGate: 65 },
  } as Partial<Record<OfficeTier, { to: OfficeTier; cost: number; reputationGate: number }>>,

  /** Research costs per unlock (§10 research tree). */
  RESEARCH_COST: { genre: 8_000, topic: 5_000, platform: 12_000 },
  /** What a 1985 garage already knows how to make. */
  STARTING_RESEARCH: {
    genres: ["rpg", "adventure", "puzzle"] as Genre[],
    topics: ["fantasy", "space", "sports"] as Topic[],
    platforms: ["pc"] as Platform[],
  },

  // --- Talent (§10: reputation opens talent willing to join you) ---
  HIRE_BASE_SKILL: 35,
  HIRE_SKILL_PER_REPUTATION: 0.45,
  HIRE_SKILL_CAP: 95,
  HIRE_SECONDARY_SKILL: 18,
  /** Signing cost, in quarters of the candidate's salary. */
  HIRE_COST_QUARTERS: 4,
} as const;

// ---------------------------------------------------------------------------
// Offices
// ---------------------------------------------------------------------------

export function maxStaff(office: OfficeTier): number {
  return PROGRESSION_TUNING.MAX_STAFF[office];
}

export function engineCeiling(office: OfficeTier): number {
  return PROGRESSION_TUNING.ENGINE_CEILING[office];
}

export function allowedScopeTiers(office: OfficeTier): readonly ScopeTier[] {
  return PROGRESSION_TUNING.ALLOWED_SCOPE[office];
}

/** The next office move, or null from the AAA campus. */
export function officeUpgrade(office: OfficeTier) {
  return PROGRESSION_TUNING.OFFICE_UPGRADES[office] ?? null;
}

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

export interface ResearchState {
  genres: Genre[];
  topics: Topic[];
  platforms: Platform[];
}

export function startingResearch(): ResearchState {
  const t = PROGRESSION_TUNING.STARTING_RESEARCH;
  return { genres: [...t.genres], topics: [...t.topics], platforms: [...t.platforms] };
}

export type ResearchKind = "genre" | "topic" | "platform";

/** Everything still locked, with what unlocking costs. */
export function lockedResearch(research: ResearchState) {
  const cost = PROGRESSION_TUNING.RESEARCH_COST;
  return {
    genres: GENRES.filter((g) => !research.genres.includes(g)).map((id) => ({
      id,
      cost: cost.genre,
    })),
    topics: TOPICS.filter((t) => !research.topics.includes(t)).map((id) => ({
      id,
      cost: cost.topic,
    })),
    platforms: PLATFORMS.filter((p) => !research.platforms.includes(p)).map((id) => ({
      id,
      cost: cost.platform,
    })),
  };
}

// ---------------------------------------------------------------------------
// Concept gating (research + office scope), on top of validateConcept
// ---------------------------------------------------------------------------

/** Progression problems blocking a concept: locked content or an office too small. */
export function conceptLocks(
  draft: ConceptDraft,
  research: ResearchState,
  office: OfficeTier,
): string[] {
  const problems: string[] = [];
  for (const genre of draft.genres) {
    if (!research.genres.includes(genre)) problems.push(`${genre} isn't researched yet.`);
  }
  if (draft.topic !== null && !research.topics.includes(draft.topic)) {
    problems.push(`${draft.topic} isn't researched yet.`);
  }
  for (const platform of draft.platforms) {
    if (!research.platforms.includes(platform)) {
      problems.push(`${platform} isn't researched yet.`);
    }
  }
  if (draft.scopeTier !== null && !allowedScopeTiers(office).includes(draft.scopeTier)) {
    problems.push(`A ${office} office can't support a ${draft.scopeTier} project.`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Talent (§10)
// ---------------------------------------------------------------------------

/**
 * The candidate your reputation attracts: skill scales with the studio's
 * name. Deterministic on purpose — the hiring pool refreshes with your
 * reputation, not with a dice roll.
 */
export function makeCandidate(specialty: Specialty, reputation: number, id: string): Staff {
  const t = PROGRESSION_TUNING;
  const skill = Math.round(
    clamp(t.HIRE_BASE_SKILL + t.HIRE_SKILL_PER_REPUTATION * clamp(reputation, 0, 100), 0, t.HIRE_SKILL_CAP),
  );
  return {
    id,
    name: `New ${specialty} hire`,
    specialty,
    skills: {
      designer: t.HIRE_SECONDARY_SKILL,
      programmer: t.HIRE_SECONDARY_SKILL,
      artist: t.HIRE_SECONDARY_SKILL,
      audio: t.HIRE_SECONDARY_SKILL,
      writer: t.HIRE_SECONDARY_SKILL,
      producer: t.HIRE_SECONDARY_SKILL,
      qa: t.HIRE_SECONDARY_SKILL,
      [specialty]: skill,
    },
    morale: 75,
    burnout: 0,
  };
}
