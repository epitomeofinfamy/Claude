import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STRATEGIES, formatReport, runCohort, summarize, type StrategyStats } from "./simulate";
import { resetTuning } from "./config";

const CAMPAIGNS = 24;
const PROJECTS = 5;

let stats: Record<string, StrategyStats>;

beforeAll(() => {
  resetTuning();
  stats = {};
  for (const strategy of STRATEGIES) {
    stats[strategy] = summarize(runCohort(strategy, CAMPAIGNS, PROJECTS, 1));
  }
  process.stdout.write(
    `\n=== ${CAMPAIGNS} campaigns × ${PROJECTS} projects per strategy (seeded) ===\n` +
      formatReport(Object.values(stats)) +
      "\n",
  );
});

afterAll(resetTuning);

describe("the playtest harness (§7.11 / §12 anti-solve)", () => {
  it("plays full campaigns for every strategy", () => {
    for (const s of Object.values(stats)) {
      expect(s.projectsShipped).toBeGreaterThan(30);
    }
  });

  it("prestige and commercial are both viable paths (§12)", () => {
    for (const id of ["prestige", "commercial"] as const) {
      expect(stats[id]!.bankruptcyRate).toBeLessThanOrEqual(0.25);
      expect(stats[id]!.meanFinalCash).toBeGreaterThan(25_000);
      expect(stats[id]!.meta.mean).toBeGreaterThan(50);
    }
  });

  it("the paths are distinct: critics reward risk, sales reward the machine (§7.8)", () => {
    const prestige = stats.prestige!;
    const commercial = stats.commercial!;
    // Prestige owns the critics…
    expect(prestige.meta.mean).toBeGreaterThan(commercial.meta.mean + 3);
    // …commercial out-earns per game…
    expect(commercial.meanRevenue).toBeGreaterThan(prestige.meanRevenue);
    // …and derivative-but-polished lands relatively better with users than
    // with juries (the §7.8 divergence, measured as user − meta).
    expect(commercial.user.mean - commercial.meta.mean).toBeGreaterThan(
      prestige.user.mean - prestige.meta.mean + 1,
    );
  });

  it("no single strategy dominates every axis (§7.11)", () => {
    const byMeta = Object.values(stats).sort((a, b) => b.meta.mean - a.meta.mean)[0]!;
    const byRevenue = Object.values(stats).sort((a, b) => b.meanRevenue - a.meanRevenue)[0]!;
    expect(byMeta.strategy).not.toBe(byRevenue.strategy);
  });

  it("degenerate strategies fail: noise, over-marketing, and perpetual crunch", () => {
    // Random play can't brute-force the system (§1 anti-pillar).
    expect(stats.random!.bankruptcyRate).toBeGreaterThanOrEqual(0.6);
    // The same trend-chasing play with maxed marketing lands worse — hype
    // is a loan against quality (§7.6) and the interest compounds.
    expect(stats["hype-machine"]!.meta.mean).toBeLessThan(stats.commercial!.meta.mean - 4);
    expect(stats["hype-machine"]!.bankruptcyRate).toBeGreaterThan(
      stats.commercial!.bankruptcyRate + 0.2,
    );
    // Crunch as a lifestyle destroys the team and then the studio (§5, §9).
    expect(stats["crunch-lord"]!.bankruptcyRate).toBeGreaterThanOrEqual(0.75);
    expect(stats["crunch-lord"]!.meta.mean).toBeLessThan(stats.prestige!.meta.mean - 20);
  });

  it("outcomes stay varied, not deterministic (§7.11 bounded variance)", () => {
    for (const id of ["prestige", "commercial"] as const) {
      expect(stats[id]!.meta.p90 - stats[id]!.meta.p10).toBeGreaterThanOrEqual(10);
      expect(stats[id]!.meta.sd).toBeGreaterThanOrEqual(4);
    }
  });
});
