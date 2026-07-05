import { afterEach, describe, expect, it } from "vitest";
import { SAVE_VERSION, buildSave, parseSave, serializeSave } from "./save";
import { applyDifficulty, resetTuning } from "./config";
import { createLoop, greenlightConcept, type StudioState } from "./loop";
import { startingResearch } from "./progression";

afterEach(resetTuning);

const studio: StudioState = {
  name: "Garage Games",
  cash: 65_000,
  reputation: 12,
  year: 1985,
  ipCatalog: [],
  staff: [
    {
      id: "s1",
      name: "Alex",
      specialty: "designer",
      skills: { designer: 65, programmer: 20, artist: 20, audio: 10, writer: 15, producer: 15, qa: 20 },
      morale: 80,
      burnout: 10,
    },
  ],
  engines: [{ id: "engine-1", name: "HomeBrew", techLevel: 25 }],
  offices: "garage",
  research: startingResearch(),
};

/** A mid-campaign state, so the save isn't just the trivial initial shape. */
function playedState() {
  return greenlightConcept(createLoop(studio), {
    title: "Crown of Embers",
    basis: { kind: "new-ip" },
    genres: ["rpg"],
    topic: "fantasy",
    platforms: ["pc"],
    scopeTier: "indie",
  });
}

describe("save/load serialization", () => {
  it("round-trips the full loop state losslessly", () => {
    const state = playedState();
    const save = parseSave(serializeSave(state));
    expect(save).not.toBeNull();
    expect(save!.state).toEqual(state);
    expect(save!.version).toBe(SAVE_VERSION);
    expect(new Date(save!.savedAt).getTime()).not.toBeNaN();
  });

  it("captures the difficulty and dials the campaign is played under", () => {
    applyDifficulty("brutal");
    const save = buildSave(playedState());
    expect(save.difficulty).toBe("brutal");
    expect(save.tuning.expectationKDown).toBe(0.2);
    // The snapshot is a copy — later config edits don't mutate the save.
    applyDifficulty("cozy");
    expect(save.tuning.expectationKDown).toBe(0.2);
  });

  it("rejects corrupt JSON, wrong shapes, and unmigratable versions", () => {
    expect(parseSave("{not json")).toBeNull();
    expect(parseSave('"a string"')).toBeNull();
    expect(parseSave("{}")).toBeNull();
    const good = buildSave(playedState());
    expect(parseSave(JSON.stringify({ ...good, version: 99 }))).toBeNull(); // from the future
    expect(parseSave(JSON.stringify({ ...good, state: null }))).toBeNull();
    expect(parseSave(JSON.stringify(good))).not.toBeNull();
  });
});
