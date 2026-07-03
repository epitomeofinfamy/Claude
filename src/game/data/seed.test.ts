import { describe, expect, it } from "vitest";
import {
  GENRES,
  PLATFORMS,
  QUALITY_AXES,
  TOPICS,
  type Game,
  type Market,
  type Staff,
  type Studio,
} from "../types";
import { computeQuality } from "../quality";
import { DEEMPHASIZED, EMPHASIZED, GENRE_PROFILES, NEUTRAL } from "./genres";
import { PLATFORM_CATALOG } from "./platforms";
import { OUTLETS } from "./outlets";

describe("genre profiles (GDD §4)", () => {
  it("covers every genre with a full, positive-sum axis profile", () => {
    for (const genre of GENRES) {
      const profile = GENRE_PROFILES[genre];
      expect(profile).toBeDefined();
      const sum = QUALITY_AXES.reduce((s, axis) => s + profile[axis], 0);
      expect(sum).toBeGreaterThan(0);
      for (const axis of QUALITY_AXES) {
        expect([EMPHASIZED, NEUTRAL, DEEMPHASIZED]).toContain(profile[axis]);
      }
    }
  });

  it("encodes the §4 emphasis table correctly (spot checks)", () => {
    expect(GENRE_PROFILES.rpg.content).toBe(EMPHASIZED);
    expect(GENRE_PROFILES.rpg.narrative).toBe(EMPHASIZED);
    expect(GENRE_PROFILES.shooter.narrative).toBe(DEEMPHASIZED);
    expect(GENRE_PROFILES.puzzle.innovation).toBe(EMPHASIZED);
    expect(GENRE_PROFILES.puzzle.content).toBe(DEEMPHASIZED);
    expect(GENRE_PROFILES.adventure.gameplay).toBe(DEEMPHASIZED);
    expect(GENRE_PROFILES.simulation.polish).toBe(EMPHASIZED);
  });

  it("profiles plug into computeQuality", () => {
    const flat70 = {
      gameplay: 70,
      content: 70,
      presentation: 70,
      narrative: 70,
      innovation: 70,
      polish: 70,
    };
    for (const genre of GENRES) {
      expect(computeQuality(flat70, GENRE_PROFILES[genre])).toBeCloseTo(70);
    }
  });
});

describe("outlet archetypes (GDD §7.4)", () => {
  it("seeds exactly the five archetypes with unique ids", () => {
    expect(OUTLETS).toHaveLength(5);
    expect(new Set(OUTLETS.map((o) => o.id)).size).toBe(5);
  });

  it("every outlet has full axis weights and in-range stats", () => {
    for (const outlet of OUTLETS) {
      const sum = QUALITY_AXES.reduce((s, axis) => s + outlet.axisWeights[axis], 0);
      expect(sum).toBeGreaterThan(0);
      for (const axis of QUALITY_AXES) {
        expect(outlet.axisWeights[axis]).toBeGreaterThanOrEqual(0);
      }
      expect(outlet.harshness).toBeGreaterThanOrEqual(0);
      expect(outlet.harshness).toBeLessThanOrEqual(1);
      expect(outlet.prestige).toBeGreaterThan(0);
      expect(outlet.prestige).toBeLessThanOrEqual(1);
      expect(outlet.variance).toBeGreaterThan(0);
    }
  });

  it("matches the §7.4 table's personalities (spot checks)", () => {
    const byId = Object.fromEntries(OUTLETS.map((o) => [o.id, o]));
    // The Mainstream Giant: high prestige, low variance (§7.4 design note).
    const giant = byId["mainstream-giant"]!;
    expect(giant.prestige).toBe(Math.max(...OUTLETS.map((o) => o.prestige)));
    expect(giant.variance).toBe(Math.min(...OUTLETS.map((o) => o.variance)));
    // The Hardcore Journal is the harshest; the surprise scores come from
    // the high-variance, low-harshness outlets.
    const journal = byId["hardcore-journal"]!;
    expect(journal.harshness).toBe(Math.max(...OUTLETS.map((o) => o.harshness)));
    expect(byId["indie-darling-blog"]!.axisWeights.innovation).toBe(
      Math.max(...OUTLETS.map((o) => o.axisWeights.innovation)),
    );
  });
});

describe("platform catalog (GDD §4, §8)", () => {
  it("covers every platform with sane data", () => {
    for (const platform of PLATFORMS) {
      const info = PLATFORM_CATALOG[platform];
      expect(info.id).toBe(platform);
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.installBase).toBeGreaterThan(0);
      for (const fit of Object.values(info.genreFit)) {
        expect(fit).toBeGreaterThan(0);
      }
    }
  });
});

describe("enumerations", () => {
  it("topics are a non-empty, unique handful", () => {
    expect(TOPICS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(TOPICS).size).toBe(TOPICS.length);
  });
});

describe("core data objects compose (GDD §15)", () => {
  it("a Studio with Staff, a Game, and a Market can be constructed from seed values", () => {
    const staff: Staff = {
      id: "staff-1",
      name: "Alex the Founder",
      specialty: "designer",
      skills: {
        designer: 60,
        programmer: 30,
        artist: 10,
        audio: 5,
        writer: 20,
        producer: 15,
        qa: 25,
      },
      morale: 80,
      burnout: 10,
    };

    const studio: Studio = {
      name: "Garage Games",
      cash: 20_000,
      reputation: 0,
      engines: [{ id: "engine-1", name: "HomeBrew 1.0", techLevel: 20 }],
      staff: [staff],
      ipCatalog: [],
      offices: "garage",
    };

    const game: Game = {
      id: "game-1",
      title: "Dungeon of the Space Crown",
      ipId: "ip-1",
      genres: ["rpg"],
      topic: "fantasy",
      platforms: ["pc"],
      scopeTier: "prototype",
      engineId: "engine-1",
      axes: {
        gameplay: 55,
        content: 60,
        presentation: 40,
        narrative: 65,
        innovation: 70,
        polish: 50,
      },
      q: computeQuality(
        {
          gameplay: 55,
          content: 60,
          presentation: 40,
          narrative: 65,
          innovation: 70,
          polish: 50,
        },
        GENRE_PROFILES.rpg,
      ),
      marketingSpend: 0,
      releaseWindow: { year: 1985, quarter: 4 },
    };

    const market: Market = {
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
        sports: "neutral",
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

    expect(studio.staff[0]!.specialty).toBe("designer");
    expect(game.q).toBeGreaterThan(0);
    expect(game.q).toBeLessThanOrEqual(100);
    expect(market.competitorCalendar).toHaveLength(1);
  });
});
