/**
 * The economy — GDD §9.
 *
 * Costs: salaries scale with skill and headcount; office overhead scales
 * with headcount; engine R&D and training are reinvestment actions (§3
 * beat 8); marketing is charged at launch (shipdecision).
 *
 * Revenue: computeSales (grow.ts) gives units × price × Metascore-driven
 * multiplier − platform cut; buildSalesTail spreads it across a
 * front-loaded quarterly tail, extended by word of mouth when the user
 * score is high (§9: patches/DLC raising the user score post-launch will
 * extend it the same way).
 *
 * Funding: self-fund (keep all upside, carry all risk) vs. a publisher
 * deal — capital up front plus marketing muscle, for a revenue cut. Gated
 * by reputation, and publishers don't fund prototypes (§9).
 *
 * Failure state: running out of cash is bankruptcy — reachable, which is
 * what gives success meaning. The loop machine enforces it.
 */

import type { ScopeTier, Staff } from "./types";
import { clamp } from "./quality";

export const ECONOMY_TUNING = {
  // --- Quarterly costs ---
  BASE_SALARY_PER_QUARTER: 600,
  /** Per point of the staffer's primary-specialty skill. */
  SALARY_PER_SKILL_POINT: 12,
  OVERHEAD_BASE: 2_000,
  OVERHEAD_PER_STAFF: 250,

  // --- Reinvestment (§3 beat 8, §10) ---
  ENGINE_UPGRADE_COST: 12_000,
  ENGINE_UPGRADE_TECH_GAIN: 10,
  TRAINING_COST_PER_STAFF: 1_500,
  /** Primary-specialty skill points gained per training program. */
  TRAINING_SKILL_GAIN: 3,

  // --- The sales tail (§9: front-loaded, extended by word of mouth) ---
  /** Relative quarterly weights; renormalized over the tail's length. */
  SALES_TAIL_WEIGHTS: [0.45, 0.25, 0.15, 0.1, 0.05],
  /** User score at or above this extends the tail (word of mouth). */
  TAIL_EXTENSION_USER_BAR: 75,
  TAIL_EXTENSION_QUARTERS: 2,

  // --- Publisher deals (§9) ---
  PUBLISHER_REPUTATION_GATE: 25,
  PUBLISHER_ADVANCE_BY_TIER: {
    prototype: 0,
    indie: 15_000,
    "double-a": 40_000,
    aaa: 100_000,
  } as Record<ScopeTier, number>,
  PUBLISHER_REVENUE_CUT: 0.35,
  /** Free marketing-hype points the publisher's machine adds at launch. */
  PUBLISHER_MARKETING_BONUS: 15,
} as const;

// ---------------------------------------------------------------------------
// Quarterly burn
// ---------------------------------------------------------------------------

/** One staffer's quarterly salary: base plus their primary skill (§9). */
export function quarterlySalary(staff: Staff): number {
  const t = ECONOMY_TUNING;
  return t.BASE_SALARY_PER_QUARTER + t.SALARY_PER_SKILL_POINT * staff.skills[staff.specialty];
}

export function quarterlyOverhead(headcount: number): number {
  return ECONOMY_TUNING.OVERHEAD_BASE + ECONOMY_TUNING.OVERHEAD_PER_STAFF * headcount;
}

/** Total quarterly outflow: payroll plus office overhead. */
export function quarterlyBurn(staff: Staff[]): number {
  return staff.reduce((s, member) => s + quarterlySalary(member), 0) + quarterlyOverhead(staff.length);
}

// ---------------------------------------------------------------------------
// The sales tail
// ---------------------------------------------------------------------------

/**
 * Spreads net revenue across a front-loaded quarterly tail. A high user
 * score extends the tail — word of mouth keeps it selling (§9).
 */
export function buildSalesTail(netRevenue: number, userScore: number): number[] {
  const t = ECONOMY_TUNING;
  const extra = userScore >= t.TAIL_EXTENSION_USER_BAR ? t.TAIL_EXTENSION_QUARTERS : 0;
  const length = t.SALES_TAIL_WEIGHTS.length + extra;
  const weights: number[] = [];
  for (let i = 0; i < length; i++) {
    weights.push(
      t.SALES_TAIL_WEIGHTS[Math.min(i, t.SALES_TAIL_WEIGHTS.length - 1)]!,
    );
  }
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const tail = weights.map((w) => Math.round((netRevenue * w) / totalWeight));
  // Rounding drift lands in the launch quarter.
  const drift = netRevenue - tail.reduce((s, v) => s + v, 0);
  tail[0] = (tail[0] ?? 0) + drift;
  return tail;
}

// ---------------------------------------------------------------------------
// Funding: self vs. publisher (§9)
// ---------------------------------------------------------------------------

export type FundingKind = "self" | "publisher";

export interface PublisherOffer {
  /** Capital paid when production begins. */
  advance: number;
  /** Share of net revenue the publisher takes. */
  revenueCut: number;
  /** Marketing-hype points the publisher adds for free at launch. */
  marketingBonus: number;
}

/**
 * The deal on the table, or null: publishers return calls only once your
 * reputation clears the gate, and they don't fund prototypes (§9's
 * "optional scope constraints").
 */
export function publisherOffer(reputation: number, scopeTier: ScopeTier): PublisherOffer | null {
  const t = ECONOMY_TUNING;
  if (reputation < t.PUBLISHER_REPUTATION_GATE) return null;
  const advance = t.PUBLISHER_ADVANCE_BY_TIER[scopeTier];
  if (advance <= 0) return null;
  return {
    advance,
    revenueCut: t.PUBLISHER_REVENUE_CUT,
    marketingBonus: t.PUBLISHER_MARKETING_BONUS,
  };
}

/** Net-to-studio revenue after the publisher's share, if any. */
export function applyRevenueCut(gross: number, deal: PublisherOffer | null): number {
  return Math.round(deal ? gross * (1 - deal.revenueCut) : gross);
}

// ---------------------------------------------------------------------------
// Reinvestment helpers (§3 beat 8)
// ---------------------------------------------------------------------------

/** All hands train their primary specialty; returns the improved roster. */
export function trainStaff(staff: Staff[]): Staff[] {
  const gain = ECONOMY_TUNING.TRAINING_SKILL_GAIN;
  return staff.map((member) => ({
    ...member,
    skills: {
      ...member.skills,
      [member.specialty]: clamp(member.skills[member.specialty] + gain, 0, 100),
    },
  }));
}

export function trainingCost(headcount: number): number {
  return ECONOMY_TUNING.TRAINING_COST_PER_STAFF * headcount;
}
