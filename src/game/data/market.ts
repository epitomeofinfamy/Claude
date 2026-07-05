/**
 * A static 1985 Market snapshot, kept as a deterministic fixture for tests.
 * The live game uses the §8 simulation in src/game/market.ts (via
 * toMarketView); nothing in the UI reads this anymore.
 */

import type { Market } from "../types";

export const STUB_MARKET: Market = {
  genreTrend: {
    rpg: "rising",
    shooter: "neutral",
    puzzle: "neutral",
    strategy: "neutral",
    adventure: "fatigued",
    simulation: "neutral",
  },
  topicTrend: {
    fantasy: "rising",
    space: "neutral",
    crime: "neutral",
    sports: "fatigued",
    horror: "neutral",
  },
  platformLifecycle: { pc: "growth", "home-console": "launch" },
  saturation: {
    rpg: 0.2,
    shooter: 0.3,
    puzzle: 0.1,
    strategy: 0.2,
    adventure: 0.6,
    simulation: 0.1,
  },
  competitorCalendar: [
    {
      id: "rival-1",
      title: "Star Raider II",
      studioName: "Macrofun",
      genres: ["shooter"],
      topic: "space",
      platforms: ["home-console"],
      releaseWindow: { year: 1985, quarter: 4 },
    },
  ],
};
