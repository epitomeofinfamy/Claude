import { describe, expect, it } from "vitest";
import { GROW_TUNING, computeSales, reputationDelta, updateIpCatalog } from "./grow";
import type { Game, Ip } from "./types";

const shippedGame: Game = {
  id: "game-1",
  title: "Dungeon of the Space Crown",
  ipId: "ip-1",
  genres: ["rpg"],
  topic: "fantasy",
  platforms: ["pc"],
  scopeTier: "indie",
  engineId: "engine-1",
  axes: { gameplay: 75, content: 78, presentation: 70, narrative: 80, innovation: 72, polish: 74 },
  q: 76,
  marketingSpend: 40,
  releaseWindow: { year: 1986, quarter: 2 },
};

describe("computeSales (§9 sketch)", () => {
  const base = { metascore: 75, userScore: 72, marketingHype: 40, price: 50, platforms: ["pc"] as Game["platforms"] };

  it("scales up with Metascore, marketing, user score — and down with price", () => {
    const sales = computeSales(base);
    expect(sales.units).toBeGreaterThan(0);
    expect(sales.revenue).toBeGreaterThan(0);
    expect(computeSales({ ...base, metascore: 90 }).units).toBeGreaterThan(sales.units);
    expect(computeSales({ ...base, marketingHype: 90 }).units).toBeGreaterThan(sales.units);
    expect(computeSales({ ...base, userScore: 95 }).units).toBeGreaterThan(sales.units);
    expect(computeSales({ ...base, price: 90 }).units).toBeLessThan(sales.units);
  });

  it("more platforms, more install base, more sales", () => {
    expect(
      computeSales({ ...base, platforms: ["pc", "home-console"] }).units,
    ).toBeGreaterThan(computeSales(base).units);
  });

  it("a flop barely moves units — the quadratic Metascore multiplier bites", () => {
    const hit = computeSales({ ...base, metascore: 85 });
    const flop = computeSales({ ...base, metascore: 45 });
    expect(flop.units).toBeLessThan(hit.units / 3);
  });
});

describe("reputationDelta (§10)", () => {
  it("rewards a strong landing, punishes a flop, and is clamped", () => {
    expect(reputationDelta(80, 75)).toBeGreaterThan(0);
    expect(reputationDelta(50, 45)).toBeLessThan(0);
    expect(reputationDelta(100, 100)).toBeLessThanOrEqual(GROW_TUNING.REP_DELTA_MAX);
    expect(reputationDelta(0, 0)).toBeGreaterThanOrEqual(GROW_TUNING.REP_DELTA_MIN);
  });
});

describe("updateIpCatalog (§10 franchises)", () => {
  it("a well-received original becomes franchise IP with pedigree", () => {
    const { catalog, ip, note } = updateIpCatalog([], shippedGame, 78, 70);
    expect(catalog).toHaveLength(1);
    expect(ip).not.toBeNull();
    expect(ip!.id).toBe("ip-1");
    expect(ip!.entries).toEqual(["game-1"]);
    expect(ip!.pedigree).toBeGreaterThan(0);
    expect(note).toContain("franchise potential");
  });

  it("a poorly-received original earns nothing", () => {
    const { catalog, ip } = updateIpCatalog([], shippedGame, 55, 50);
    expect(catalog).toHaveLength(0);
    expect(ip).toBeNull();
  });

  it("a sequel feeds its existing IP: entry appended, pedigree blended", () => {
    const existing: Ip = {
      id: "ip-1",
      name: "Space Crown",
      genres: ["rpg"],
      topic: "fantasy",
      pedigree: 80,
      entries: ["game-0"],
    };
    const sequel: Game = { ...shippedGame, id: "game-2", isSequelOf: "game-0" };
    const { catalog, ip } = updateIpCatalog([existing], sequel, 60, 55);
    expect(catalog).toHaveLength(1);
    expect(ip!.entries).toEqual(["game-0", "game-2"]);
    // A weak sequel drags pedigree down toward its own score.
    expect(ip!.pedigree).toBeLessThan(80);
    expect(ip!.pedigree).toBeGreaterThan(55);
  });
});
