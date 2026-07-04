import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT,
  blendGenreProfiles,
  greenlightGame,
  researchTrendFit,
  validateConcept,
  type ConceptDraft,
  type GreenlightContext,
} from "./conception";
import { GENRE_PROFILES } from "./data/genres";
import { STUB_MARKET } from "./data/market";
import { QUALITY_AXES, type Ip } from "./types";

const catalogIp: Ip = {
  id: "ip-crown",
  name: "Space Crown",
  genres: ["rpg"],
  topic: "fantasy",
  pedigree: 55,
  entries: ["game-crown-1", "game-crown-2"],
};

function validDraft(): ConceptDraft {
  return {
    title: "Dungeon of the Space Crown",
    basis: { kind: "new-ip" },
    genres: ["rpg"],
    topic: "fantasy",
    platforms: ["pc"],
    scopeTier: "indie",
  };
}

function ctx(): GreenlightContext {
  return {
    gameId: "game-1",
    newIpId: "ip-new-1",
    engineId: "engine-1",
    releaseWindow: { year: 1985, quarter: 4 },
    ipCatalog: [catalogIp],
  };
}

describe("blendGenreProfiles (§4 hybrids)", () => {
  it("a single genre returns its own profile", () => {
    expect(blendGenreProfiles(["puzzle"])).toEqual(GENRE_PROFILES.puzzle);
  });

  it("a hybrid averages the two profiles per axis into a merged target", () => {
    const blend = blendGenreProfiles(["rpg", "shooter"]); // Action-RPG
    for (const axis of QUALITY_AXES) {
      expect(blend[axis]).toBeCloseTo(
        (GENRE_PROFILES.rpg[axis] + GENRE_PROFILES.shooter[axis]) / 2,
      );
    }
    // The merged target matches neither parent (the anti-solve point).
    expect(blend).not.toEqual(GENRE_PROFILES.rpg);
    expect(blend).not.toEqual(GENRE_PROFILES.shooter);
    // e.g. RPG de-emphasizes nothing, Shooter de-emphasizes Narrative → middle.
    expect(blend.narrative).toBe(1.25);
  });

  it("is order-independent and rejects bad genre counts", () => {
    expect(blendGenreProfiles(["rpg", "shooter"])).toEqual(
      blendGenreProfiles(["shooter", "rpg"]),
    );
    expect(() => blendGenreProfiles([])).toThrow();
    expect(() => blendGenreProfiles(["rpg", "rpg"])).toThrow();
    expect(() =>
      blendGenreProfiles(["rpg", "shooter", "puzzle"] as never),
    ).toThrow();
  });
});

describe("validateConcept", () => {
  it("accepts a complete draft", () => {
    expect(validateConcept(validDraft(), [catalogIp])).toEqual([]);
  });

  it("accepts a valid sequel draft", () => {
    const draft: ConceptDraft = {
      ...validDraft(),
      basis: { kind: "sequel", ipId: catalogIp.id },
    };
    expect(validateConcept(draft, [catalogIp])).toEqual([]);
  });

  it("collects every missing choice", () => {
    const problems = validateConcept(EMPTY_DRAFT, []);
    expect(problems.length).toBe(5); // title, genre, topic, platform, scope
  });

  it("rejects a duplicate-genre hybrid and an unknown sequel IP", () => {
    expect(
      validateConcept({ ...validDraft(), genres: ["rpg", "rpg"] }, [catalogIp]),
    ).toContain("A hybrid must blend two different genres.");
    expect(
      validateConcept(
        { ...validDraft(), basis: { kind: "sequel", ipId: "ip-ghost" } },
        [catalogIp],
      ),
    ).toContain("A sequel needs an existing IP from the catalog.");
  });
});

describe("researchTrendFit (partial signal, stub market)", () => {
  it("reads hot for a rising genre + rising topic", () => {
    const signal = researchTrendFit(["rpg"], "fantasy", STUB_MARKET);
    expect(signal.overall).toBe("hot");
    expect(signal.readings).toHaveLength(2);
    expect(signal.readings[0]!.phase).toBe("rising");
  });

  it("reads cool for a fatigued genre + fatigued topic", () => {
    const signal = researchTrendFit(["adventure"], "sports", STUB_MARKET);
    expect(signal.overall).toBe("cool");
  });

  it("reads warm in the middle, covering hybrids", () => {
    const signal = researchTrendFit(["shooter", "strategy"], "space", STUB_MARKET);
    expect(signal.overall).toBe("warm");
    expect(signal.readings).toHaveLength(3); // two genres + topic
  });

  it("gives direction only — every reading is a phase plus a canned comment", () => {
    const signal = researchTrendFit(["rpg"], "horror", STUB_MARKET);
    for (const reading of signal.readings) {
      expect(["rising", "neutral", "fatigued"]).toContain(reading.phase);
      expect(reading.comment.length).toBeGreaterThan(0);
    }
  });
});

describe("greenlightGame", () => {
  it("produces a configured Game ready for production, axes at zero", () => {
    const game = greenlightGame(validDraft(), ctx());
    expect(game).toMatchObject({
      id: "game-1",
      title: "Dungeon of the Space Crown",
      ipId: "ip-new-1",
      genres: ["rpg"],
      topic: "fantasy",
      platforms: ["pc"],
      scopeTier: "indie",
      engineId: "engine-1",
      q: 0,
      marketingSpend: 0,
      releaseWindow: { year: 1985, quarter: 4 },
    });
    for (const axis of QUALITY_AXES) expect(game.axes[axis]).toBe(0);
    expect(game.isSequelOf).toBeUndefined();
  });

  it("a sequel joins its IP and points at the latest entry", () => {
    const game = greenlightGame(
      { ...validDraft(), title: "Space Crown III", basis: { kind: "sequel", ipId: catalogIp.id } },
      ctx(),
    );
    expect(game.ipId).toBe("ip-crown");
    expect(game.isSequelOf).toBe("game-crown-2");
  });

  it("supports hybrid concepts", () => {
    const game = greenlightGame(
      { ...validDraft(), genres: ["rpg", "shooter"] },
      ctx(),
    );
    expect(game.genres).toEqual(["rpg", "shooter"]);
  });

  it("refuses to greenlight an invalid draft", () => {
    expect(() => greenlightGame(EMPTY_DRAFT, ctx())).toThrow(/not ready/);
  });

  it("does not share references with the draft", () => {
    const draft = validDraft();
    const game = greenlightGame(draft, ctx());
    draft.genres.push("puzzle");
    draft.platforms.push("home-console");
    expect(game.genres).toEqual(["rpg"]);
    expect(game.platforms).toEqual(["pc"]);
  });
});
