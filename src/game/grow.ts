/**
 * Grow — GDD §3 beat 8 (with the §9 sales sketch it needs).
 *
 * After reception, the outcome compounds: the Metascore drives a sales
 * multiplier (§7.7), sales become cash, reputation moves (and with it the
 * §7.6 expectation bar), and a well-received original becomes franchise IP
 * with pedigree — the §10 asset that future sequels inherit.
 *
 * The economy here is deliberately simple — enough for the §16 MVP spine;
 * the full §9 model (sales tails, publisher deals, failure states) comes
 * later and replaces computeSales.
 */

import type { Game, Ip, Platform } from "./types";
import { clamp } from "./quality";
import { PLATFORM_CATALOG } from "./data/platforms";

export const GROW_TUNING = {
  // --- Sales (§9 sketch) ---
  /** Install-base share a Metascore-at-pivot game reaches before modifiers. */
  BASE_ATTACH_RATE: 0.0008,
  /** Metascore at which the sales multiplier is 1; quadratic around it (§7.7). */
  META_SALES_PIVOT: 70,
  PRICE_FLOOR_DOLLARS: 10,
  PRICE_DOLLARS_PER_POINT: 0.4,
  /** Platform holder's cut of revenue (§9). */
  PLATFORM_CUT: 0.3,

  // --- Reputation (§10: the compounding asset) ---
  REP_META_PIVOT: 65,
  REP_META_WEIGHT: 1 / 3,
  REP_USER_WEIGHT: 1 / 6,
  REP_DELTA_MIN: -10,
  REP_DELTA_MAX: 12,

  // --- Franchise potential (§7.7 unlocks, §10 IP) ---
  FRANCHISE_METASCORE_BAR: 65,

  // --- Downtime between projects heals the team (§5) ---
  POST_PROJECT_MORALE_RECOVERY: 10,
  POST_PROJECT_BURNOUT_RECOVERY: 20,
} as const;

export interface SalesResult {
  units: number;
  /** Net revenue after the platform cut. */
  revenue: number;
}

/** Metascore-driven sales, shaded by user score, marketing reach, and price. */
export function computeSales(args: {
  metascore: number;
  userScore: number;
  marketingHype: number;
  price: number;
  platforms: Platform[];
  /** Live per-platform install bases (§8 lifecycles); catalog seeds if omitted. */
  installBases?: Partial<Record<Platform, number>>;
}): SalesResult {
  const t = GROW_TUNING;
  const installBase = args.platforms.reduce(
    (s, p) => s + (args.installBases?.[p] ?? PLATFORM_CATALOG[p].installBase),
    0,
  );
  const metaMult = (clamp(args.metascore, 0, 100) / t.META_SALES_PIVOT) ** 2;
  const userMult = 0.75 + 0.5 * (clamp(args.userScore, 0, 100) / 100);
  const hypeMult = 0.6 + 0.8 * (clamp(args.marketingHype, 0, 100) / 100);
  const demandMult = 1.3 - 0.6 * (clamp(args.price, 0, 100) / 100);
  const units = Math.round(
    installBase * t.BASE_ATTACH_RATE * metaMult * userMult * hypeMult * demandMult,
  );
  const dollars = t.PRICE_FLOOR_DOLLARS + t.PRICE_DOLLARS_PER_POINT * clamp(args.price, 0, 100);
  return { units, revenue: Math.round(units * dollars * (1 - t.PLATFORM_CUT)) };
}

/** How the landing moves the studio's reputation (§10: the bar rises with you). */
export function reputationDelta(metascore: number, userScore: number): number {
  const t = GROW_TUNING;
  return clamp(
    (metascore - t.REP_META_PIVOT) * t.REP_META_WEIGHT +
      (userScore - t.REP_META_PIVOT) * t.REP_USER_WEIGHT,
    t.REP_DELTA_MIN,
    t.REP_DELTA_MAX,
  );
}

export interface IpUpdate {
  catalog: Ip[];
  /** The IP created or updated, if the game earned one. */
  ip: Ip | null;
  note: string | null;
}

/**
 * Franchise bookkeeping (§10): a sequel feeds its IP's pedigree and entry
 * list; a well-received original (Metascore over the bar) becomes new IP.
 */
export function updateIpCatalog(
  catalog: Ip[],
  game: Game,
  metascore: number,
  userScore: number,
): IpUpdate {
  const t = GROW_TUNING;
  const score = Math.round(0.6 * metascore + 0.4 * userScore);
  const existing = catalog.find((ip) => ip.id === game.ipId);

  if (existing) {
    const updated: Ip = {
      ...existing,
      pedigree: clamp(Math.round(0.5 * existing.pedigree + 0.5 * score), 0, 100),
      entries: [...existing.entries, game.id],
    };
    return {
      catalog: catalog.map((ip) => (ip.id === updated.id ? updated : ip)),
      ip: updated,
      note: `${updated.name} pedigree is now ${updated.pedigree}.`,
    };
  }

  if (metascore >= t.FRANCHISE_METASCORE_BAR) {
    const ip: Ip = {
      id: game.ipId,
      name: game.title,
      genres: [...game.genres],
      topic: game.topic,
      pedigree: clamp(Math.round(0.8 * score), 0, 100),
      entries: [game.id],
    };
    return {
      catalog: [...catalog, ip],
      ip,
      note: `${game.title} has franchise potential (pedigree ${ip.pedigree}).`,
    };
  }

  return { catalog, ip: null, note: null };
}
