import { describe, expect, it } from "vitest";
import {
  ECONOMY_TUNING,
  applyRevenueCut,
  buildSalesTail,
  publisherOffer,
  quarterlyBurn,
  quarterlySalary,
  trainStaff,
  trainingCost,
} from "./economy";
import type { Specialty, Staff } from "./types";

function makeStaff(id: string, specialty: Specialty, skill: number): Staff {
  return {
    id,
    name: id,
    specialty,
    skills: {
      designer: 20,
      programmer: 20,
      artist: 20,
      audio: 20,
      writer: 20,
      producer: 20,
      qa: 20,
      [specialty]: skill,
    },
    morale: 80,
    burnout: 10,
  };
}

describe("salaries and overhead (§9)", () => {
  it("salaries scale with skill; the burn scales with headcount", () => {
    const junior = makeStaff("j", "designer", 30);
    const star = makeStaff("s", "designer", 90);
    expect(quarterlySalary(star)).toBeGreaterThan(quarterlySalary(junior));

    const small = quarterlyBurn([junior, star]);
    const large = quarterlyBurn([junior, star, makeStaff("a", "artist", 60), makeStaff("q", "qa", 60)]);
    expect(large).toBeGreaterThan(small);
    // Overhead means even one person costs more than their salary.
    expect(quarterlyBurn([junior])).toBeGreaterThan(quarterlySalary(junior));
  });
});

describe("the sales tail (§9)", () => {
  it("is front-loaded and sums to the total", () => {
    const tail = buildSalesTail(100_000, 60);
    expect(tail).toHaveLength(ECONOMY_TUNING.SALES_TAIL_WEIGHTS.length);
    expect(tail[0]!).toBeGreaterThan(tail[tail.length - 1]!);
    expect(tail.reduce((s, v) => s + v, 0)).toBe(100_000);
  });

  it("a high user score extends the tail — word of mouth keeps it selling", () => {
    const loved = buildSalesTail(100_000, ECONOMY_TUNING.TAIL_EXTENSION_USER_BAR);
    const shrugged = buildSalesTail(100_000, 60);
    expect(loved.length).toBe(shrugged.length + ECONOMY_TUNING.TAIL_EXTENSION_QUARTERS);
    expect(loved.reduce((s, v) => s + v, 0)).toBe(100_000);
    // Same money, spread longer: the launch quarter is smaller.
    expect(loved[0]!).toBeLessThan(shrugged[0]!);
  });
});

describe("publisher deals (§9)", () => {
  it("are gated by reputation and don't fund prototypes", () => {
    expect(publisherOffer(10, "indie")).toBeNull();
    expect(publisherOffer(ECONOMY_TUNING.PUBLISHER_REPUTATION_GATE, "prototype")).toBeNull();
    const offer = publisherOffer(ECONOMY_TUNING.PUBLISHER_REPUTATION_GATE, "indie");
    expect(offer).not.toBeNull();
    expect(offer!.advance).toBeGreaterThan(0);
    expect(offer!.marketingBonus).toBeGreaterThan(0);
  });

  it("bigger bets get bigger advances; the cut comes off the top", () => {
    const indie = publisherOffer(50, "indie")!;
    const aaa = publisherOffer(50, "aaa")!;
    expect(aaa.advance).toBeGreaterThan(indie.advance);
    expect(applyRevenueCut(100_000, indie)).toBe(
      Math.round(100_000 * (1 - indie.revenueCut)),
    );
    expect(applyRevenueCut(100_000, null)).toBe(100_000);
  });
});

describe("training (§9)", () => {
  it("sharpens primary specialties for a per-head cost, capped at 100", () => {
    const team = [makeStaff("a", "designer", 60), makeStaff("b", "qa", 99)];
    const trained = trainStaff(team);
    expect(trained[0]!.skills.designer).toBe(60 + ECONOMY_TUNING.TRAINING_SKILL_GAIN);
    expect(trained[1]!.skills.qa).toBe(100);
    expect(trainingCost(2)).toBe(2 * ECONOMY_TUNING.TRAINING_COST_PER_STAFF);
    // Off-specialty skills are untouched.
    expect(trained[0]!.skills.artist).toBe(team[0]!.skills.artist);
  });
});
