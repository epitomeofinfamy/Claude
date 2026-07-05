import { describe, expect, it } from "vitest";
import {
  STUDIO_EVENT_TUNING,
  acquisitionOffer,
  eventWeights,
  rollStudioEvent,
  type StudioEventContext,
} from "./studioEvents";
import type { Specialty, Staff } from "./types";

function makeStaff(id: string, specialty: Specialty, skill: number): Staff {
  return {
    id,
    name: `${specialty}-${id}`,
    specialty,
    skills: {
      designer: 25,
      programmer: 25,
      artist: 25,
      audio: 25,
      writer: 25,
      producer: 25,
      qa: 25,
      [specialty]: skill,
    },
    morale: 70,
    burnout: 20,
  };
}

/** A quiet mid-career studio: nothing newsworthy about it. */
function quietContext(): StudioEventContext {
  return {
    studio: {
      reputation: 30,
      cash: 80_000,
      staff: [makeStaff("a", "designer", 60), makeStaff("b", "artist", 55)],
    },
    launch: {
      metascore: 70,
      userScore: 68,
      gap: 2,
      genres: ["rpg"],
      crunchShare: 0.1,
      departures: 0,
    },
    campaignYears: 2,
  };
}

describe("event conditions (§11: weighted by studio state)", () => {
  it("a quiet studio triggers nothing — every weight is zero", () => {
    const weights = eventWeights(quietContext());
    for (const weight of Object.values(weights)) expect(weight).toBe(0);
    expect(rollStudioEvent(quietContext(), () => 0)).toBeNull();
  });

  it("award shows need a critical hit, and bigger hits weigh more", () => {
    const ctx = quietContext();
    ctx.launch!.metascore = STUDIO_EVENT_TUNING.AWARD_METASCORE_BAR - 1;
    expect(eventWeights(ctx)["award-show"]).toBe(0);
    ctx.launch!.metascore = 82;
    const modest = eventWeights(ctx)["award-show"];
    ctx.launch!.metascore = 92;
    expect(modest).toBeGreaterThan(0);
    expect(eventWeights(ctx)["award-show"]).toBeGreaterThan(modest);
  });

  it("the crunch exposé needs a crunch habit or walked-out staff", () => {
    const ctx = quietContext();
    expect(eventWeights(ctx)["crunch-expose"]).toBe(0);
    ctx.launch!.crunchShare = 0.6;
    expect(eventWeights(ctx)["crunch-expose"]).toBeGreaterThan(0);
    const crunchOnly = eventWeights(ctx)["crunch-expose"];
    ctx.launch!.departures = 2;
    expect(eventWeights(ctx)["crunch-expose"]).toBeGreaterThan(crunchOnly);
  });

  it("viral moments need users who love it; underdogs get a bonus", () => {
    const ctx = quietContext();
    expect(eventWeights(ctx)["viral-moment"]).toBe(0);
    ctx.launch!.userScore = 82;
    const plain = eventWeights(ctx)["viral-moment"];
    expect(plain).toBeGreaterThan(0);
    ctx.launch!.gap = 20; // humble marketing, huge delivery
    expect(eventWeights(ctx)["viral-moment"]).toBe(
      plain + STUDIO_EVENT_TUNING.VIRAL_UNDERDOG_BONUS,
    );
  });

  it("veterans retire only from long campaigns with real veterans", () => {
    const ctx = quietContext();
    ctx.campaignYears = 10;
    expect(eventWeights(ctx)["veteran-retires"]).toBe(0); // nobody skilled enough
    ctx.studio.staff.push(makeStaff("vet", "programmer", 80));
    expect(eventWeights(ctx)["veteran-retires"]).toBeGreaterThan(0);
    ctx.campaignYears = 2; // too early for retirements
    expect(eventWeights(ctx)["veteran-retires"]).toBe(0);
  });

  it("acquirers only call famous studios, and offers scale with reputation", () => {
    const ctx = quietContext();
    expect(eventWeights(ctx)["acquisition-offer"]).toBe(0);
    ctx.studio.reputation = 70;
    expect(eventWeights(ctx)["acquisition-offer"]).toBeGreaterThan(0);
    expect(acquisitionOffer(80)).toBeGreaterThan(acquisitionOffer(60));
  });
});

describe("the roll", () => {
  it("fires an eligible event on a low roll, stays quiet on a high one", () => {
    const ctx = quietContext();
    ctx.launch!.metascore = 90; // only the award show is eligible
    const fired = rollStudioEvent(ctx, () => 0);
    expect(fired).not.toBeNull();
    expect(fired!.id).toBe("award-show");
    expect(rollStudioEvent(ctx, () => 0.999)).toBeNull(); // QUIET_WEIGHT wins
  });

  it("builds instances with the right shape and personalized text", () => {
    const ctx = quietContext();
    ctx.campaignYears = 8;
    ctx.studio.staff.push(makeStaff("vet", "writer", 85));
    const fired = rollStudioEvent(ctx, () => 0)!;
    expect(fired.id).toBe("veteran-retires");
    expect(fired.headline).toContain("writer-vet");
    expect(fired.options).toHaveLength(2);
    const sendOff = fired.options.find((o) => o.id === "send-off")!;
    expect(sendOff.effects.staffLeaves).toBe("vet");
    expect(sendOff.effects.skillBump).toEqual({
      specialty: "writer",
      amount: STUDIO_EVENT_TUNING.VETERAN_PARTING_SKILL_GIFT,
    });
  });

  it("acquisition offers quote a number that matches the effects", () => {
    const ctx = quietContext();
    ctx.studio.reputation = 75;
    ctx.launch = null; // even between hits, the suits still call
    const fired = rollStudioEvent(ctx, () => 0)!;
    expect(fired.id).toBe("acquisition-offer");
    const sellOut = fired.options.find((o) => o.id === "take-the-money")!;
    expect(sellOut.effects.cash).toBe(acquisitionOffer(75));
    expect(fired.body).toContain(acquisitionOffer(75).toLocaleString());
  });
});
