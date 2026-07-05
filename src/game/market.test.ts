import { describe, expect, it } from "vitest";
import {
  MARKET_TUNING,
  advanceMarketQuarter,
  createMarketSim,
  genrePhase,
  installBases,
  platformStage,
  recordRelease,
  toMarketView,
  topicPhase,
  upcomingWindows,
  type MarketSimState,
} from "./market";
import { reviewCritics, trendMod, type ReviewInputs } from "./reviews";
import { OUTLETS } from "./data/outlets";
import { GENRES, PLATFORMS, TOPICS } from "./types";

/** Neutral rng: zero noise, no announcements, no raids. */
const neutralRng = () => 0.5;

function makeRng(values: number[] = []): () => number {
  const queue = [...values];
  return () => queue.shift() ?? 0.99;
}

function ticks(sim: MarketSimState, quarters: number, rng = neutralRng): MarketSimState {
  let s = sim;
  for (let i = 0; i < quarters; i++) s = advanceMarketQuarter(s, rng).sim;
  return s;
}

/** RNG draws consumed before the announce rolls: one per genre + topic curve. */
const CURVE_DRAWS = GENRES.length + TOPICS.length;

describe("hype/trend curves (§8)", () => {
  it("trends rise, crest, and fall on their own cycle", () => {
    let sim = createMarketSim();
    const phases = new Set<string>();
    for (let i = 0; i < 40; i++) {
      sim = advanceMarketQuarter(sim, neutralRng).sim;
      phases.add(genrePhase(sim, "rpg"));
      phases.add(topicPhase(sim, "fantasy"));
    }
    // The mean-reverting curve oscillates: both ends of the cycle show up.
    expect(phases).toContain("rising");
    expect(phases).toContain("fatigued");
  });

  it("stays bounded under noisy conditions", () => {
    const sim = ticks(createMarketSim(), 60, () => 0.99);
    for (const genre of GENRES) {
      expect(sim.genreHype[genre].level).toBeGreaterThanOrEqual(0);
      expect(sim.genreHype[genre].level).toBeLessThanOrEqual(100);
      expect(Math.abs(sim.genreHype[genre].momentum)).toBeLessThanOrEqual(
        MARKET_TUNING.MOMENTUM_CAP,
      );
    }
  });
});

describe("a rising trend boosts, a saturated trend penalizes (§7.6 TrendMod)", () => {
  it("saturation flips a hot genre to fatigued and erodes the review bonus", () => {
    const fresh = createMarketSim();
    expect(genrePhase(fresh, "rpg")).toBe("rising");

    // Flood the genre: four releases in a quarter.
    let flooded = fresh;
    for (let i = 0; i < 4; i++) flooded = recordRelease(flooded, ["rpg"]);
    expect(flooded.saturation.rpg).toBeGreaterThanOrEqual(
      MARKET_TUNING.SATURATION_FATIGUE_BAR,
    );
    expect(genrePhase(flooded, "rpg")).toBe("fatigued");

    // Same game, same everything — only the trend context differs.
    const inputs = (sim: MarketSimState): ReviewInputs => ({
      axes: { gameplay: 75, content: 78, presentation: 72, narrative: 76, innovation: 70, polish: 74 },
      q: 75,
      expectation: { marketingHype: 40, scopeTier: "indie", reputation: 30, sequelPedigree: 0 },
      context: {
        genreTrend: genrePhase(sim, "rpg"),
        topicTrend: "neutral",
        windowCrowding: "normal",
        platformFit: 1,
        isSequel: false,
      },
    });
    const rising = reviewCritics(inputs(fresh), OUTLETS, () => 0.5);
    const saturated = reviewCritics(inputs(flooded), OUTLETS, () => 0.5);
    expect(rising.metascore).toBeGreaterThan(saturated.metascore + 3);
    expect(trendMod("rising")).toBeGreaterThan(trendMod("fatigued"));
  });

  it("saturation decays over time — a burned trend recovers", () => {
    let sim = createMarketSim();
    for (let i = 0; i < 4; i++) sim = recordRelease(sim, ["rpg"]);
    const flooded = sim.saturation.rpg;
    sim = advanceMarketQuarter(sim, neutralRng).sim;
    expect(sim.saturation.rpg).toBeCloseTo(flooded * MARKET_TUNING.SATURATION_DECAY);
    // Enough quarters and the genre reads as a trend again.
    sim = ticks(sim, 8);
    expect(sim.saturation.rpg).toBeLessThan(MARKET_TUNING.SATURATION_FATIGUE_BAR);
  });
});

describe("platform lifecycles (§8)", () => {
  it("age walks launch → growth → peak → decline", () => {
    const sim = createMarketSim(); // home-console launched 1985
    expect(platformStage(sim, "home-console")).toBe("launch");
    expect(platformStage({ ...sim, year: 1987 }, "home-console")).toBe("growth");
    expect(platformStage({ ...sim, year: 1990 }, "home-console")).toBe("peak");
    expect(platformStage({ ...sim, year: 1994 }, "home-console")).toBe("decline");
  });

  it("the stage moves the install base each quarter", () => {
    const sim = createMarketSim();
    const launchBase = sim.platforms["home-console"].installBase;
    const grown = advanceMarketQuarter(sim, neutralRng).sim;
    expect(grown.platforms["home-console"].installBase).toBeGreaterThan(launchBase);

    const declining = advanceMarketQuarter({ ...sim, year: 1995 }, neutralRng).sim;
    expect(declining.platforms["home-console"].installBase).toBeLessThan(launchBase);
    expect(installBases(grown)["home-console"]).toBeGreaterThan(0);
  });
});

describe("AI competitors (§8)", () => {
  it("announce games onto the visible calendar, then ship them into the trend", () => {
    const sim = createMarketSim();
    // Curve draws neutral; competitor 1 announces (roll, topic, platform, lead, title×2).
    // The pre-seeded Star Raider II ships on this same tick (its Q4 window is due).
    const announced = advanceMarketQuarter(
      sim,
      makeRng([
        ...Array(CURVE_DRAWS).fill(0.5),
        0.1, 0.5, 0.5, 0.3, 0.2, 0.6, // Macrofun announces, 1 quarter out
      ]),
    );
    const upcoming = announced.sim.calendar.filter((e) => !e.shipped);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]!.launch.releaseWindow).toEqual({ year: 1986, quarter: 1 });
    expect(announced.news.some((n) => n.includes("announced"))).toBe(true);

    const newEntry = upcoming[upcoming.length - 1]!.launch;
    const genre = newEntry.genres[0]!;
    const satBefore = announced.sim.saturation[genre];

    // Next quarter it ships: news + saturation for its genre.
    const shipped = advanceMarketQuarter(announced.sim, neutralRng);
    expect(shipped.news.some((n) => n.includes(`shipped ${newEntry.title}`))).toBe(true);
    expect(shipped.sim.saturation[genre]).toBeGreaterThan(
      satBefore * MARKET_TUNING.SATURATION_DECAY,
    );
  });

  it("can raid your staff", () => {
    const tick = advanceMarketQuarter(
      createMarketSim(),
      makeRng([...Array(CURVE_DRAWS).fill(0.5), 0.99, 0.99, 0.99, 0.05, 0.5]),
    );
    expect(tick.poachRaidBy).toBe("Pixel Forge");

    const quiet = advanceMarketQuarter(createMarketSim(), neutralRng);
    expect(quiet.poachRaidBy).toBeNull();
  });
});

describe("the Market view (§15)", () => {
  it("projects the sim into the shape the pipeline consumes", () => {
    const view = toMarketView(createMarketSim());
    for (const genre of GENRES) {
      expect(["rising", "neutral", "fatigued"]).toContain(view.genreTrend[genre]);
      expect(view.saturation[genre]).toBeGreaterThanOrEqual(0);
    }
    for (const topic of TOPICS) {
      expect(["rising", "neutral", "fatigued"]).toContain(view.topicTrend[topic]);
    }
    for (const platform of PLATFORMS) {
      expect(["launch", "growth", "peak", "decline"]).toContain(
        view.platformLifecycle[platform],
      );
    }
    expect(view.competitorCalendar.length).toBeGreaterThan(0);
  });

  it("upcomingWindows counts forward from the current quarter", () => {
    expect(upcomingWindows(createMarketSim(), 3)).toEqual([
      { year: 1985, quarter: 4 },
      { year: 1986, quarter: 1 },
      { year: 1986, quarter: 2 },
    ]);
  });
});
