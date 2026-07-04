import { describe, expect, it } from "vitest";
import {
  POSTLAUNCH_TUNING,
  abandon,
  advanceWeek,
  applyContentUpdate,
  applyPatch,
  createReceptionState,
  reReviewMajorUpdate,
  type ReceptionState,
} from "./postlaunch";
import { reviewCritics, type ReviewInputs } from "./reviews";
import { OUTLETS } from "./data/outlets";
import { GENRE_PROFILES } from "./data/genres";

const noNoise = () => 0.5;

/** The §7.12 worked example, run through the real launch pipeline. */
function workedExampleLaunch(): ReceptionState {
  const review: ReviewInputs = {
    axes: {
      gameplay: 80,
      content: 84,
      presentation: 88,
      narrative: 78,
      innovation: 55,
      polish: 60,
    },
    q: 79,
    expectation: { marketingHype: 80, scopeTier: "aaa", reputation: 70, sequelPedigree: 60 },
    context: {
      genreTrend: "neutral",
      topicTrend: "neutral",
      windowCrowding: "crowded",
      platformFit: 1,
      isSequel: true,
    },
  };
  const reception = reviewCritics(review, OUTLETS, noNoise);
  return createReceptionState({
    axes: review.axes,
    q: review.q,
    genreProfile: GENRE_PROFILES.rpg,
    expectation: review.expectation,
    context: review.context,
    gap: reception.gap,
    metascore: reception.metascore,
    price: 50,
  });
}

/** A broken launch: strong game underneath, disastrous stability. */
function brokenLaunch(): ReceptionState {
  const base = workedExampleLaunch();
  return createReceptionState({
    axes: { ...base.axes, polish: 40 },
    q: 76,
    genreProfile: GENRE_PROFILES.rpg,
    expectation: base.expectation,
    context: base.context,
    gap: base.gap,
    metascore: base.metascore,
    price: 50,
  });
}

describe("the §7.12 redemption arc", () => {
  it("two patches move the user score from ~62 to ~80 while critics stay locked", () => {
    const launch = workedExampleLaunch();
    // GDD §7.12: user score ≈ 62 at launch.
    expect(launch.userScore).toBeGreaterThan(58);
    expect(launch.userScore).toBeLessThan(66);

    const patched = applyPatch(applyPatch(launch));
    // GDD §7.12: two patches later, LaunchPolish repaired → user score ≈ 80.
    expect(patched.userScore).toBeGreaterThan(76);
    expect(patched.userScore).toBeLessThan(84);
    expect(patched.axes.polish).toBeGreaterThan(80);
    // Critic scores are locked at launch — patches alone never move them.
    expect(patched.metascore).toBe(launch.metascore);
  });

  it("patches have diminishing returns and respect the polish cap", () => {
    const launch = workedExampleLaunch();
    const once = applyPatch(launch);
    const twice = applyPatch(once);
    const firstGain = once.axes.polish - launch.axes.polish;
    const secondGain = twice.axes.polish - once.axes.polish;
    expect(secondGain).toBeLessThan(firstGain);

    let state = launch;
    for (let i = 0; i < 20; i++) state = applyPatch(state);
    expect(state.axes.polish).toBeLessThanOrEqual(POSTLAUNCH_TUNING.PATCH_POLISH_CAP);
  });

  it("repairing polish also lifts Q by the axis's genre-profile share", () => {
    const launch = workedExampleLaunch();
    const patched = applyPatch(launch);
    expect(patched.q).toBeGreaterThan(launch.q);
    // RPG profile: polish carries 1/8 of the total weight.
    const gain = patched.axes.polish - launch.axes.polish;
    expect(patched.q - launch.q).toBeCloseTo(gain / 8, 5);
  });
});

describe("content updates (DLC)", () => {
  it("raise Content and the user score, and re-engage goodwill", () => {
    const launch = workedExampleLaunch();
    const updated = applyContentUpdate(launch);
    expect(updated.axes.content).toBeGreaterThan(launch.axes.content);
    expect(updated.userScore).toBeGreaterThan(launch.userScore);
    expect(updated.sentiment).toBeGreaterThan(launch.sentiment);
    expect(updated.metascore).toBe(launch.metascore);
  });

  it("scale with size", () => {
    const launch = workedExampleLaunch();
    const small = applyContentUpdate(launch, 30);
    const large = applyContentUpdate(launch, 100);
    expect(large.axes.content).toBeGreaterThan(small.axes.content);
  });
});

describe("abandonment decay (§7.9)", () => {
  function weeks(state: ReceptionState, n: number): ReceptionState {
    let s = state;
    for (let i = 0; i < n; i++) s = advanceWeek(s);
    return s;
  }

  it("an abandoned broken game bleeds user score, sentiment, and reputation", () => {
    const rotting = weeks(abandon(brokenLaunch()), 10);
    const fresh = brokenLaunch();
    expect(rotting.userScore).toBeLessThan(fresh.userScore - 5);
    expect(rotting.sentiment).toBeLessThan(fresh.sentiment);
    expect(rotting.reputationDelta).toBeLessThan(0);
    expect(rotting.weeksSinceLaunch).toBe(10);
  });

  it("a supported game does not decay with time", () => {
    const later = weeks(brokenLaunch(), 10);
    expect(later.userScore).toBeCloseTo(brokenLaunch().userScore);
    expect(later.reputationDelta).toBe(0);
  });

  it("abandoning a healthy game is harmless — only broken games rot", () => {
    const healthy = workedExampleLaunch();
    const patched = applyPatch(applyPatch(healthy)); // polish > BROKEN_POLISH_BAR
    const later = weeks(abandon(patched), 10);
    expect(later.userScore).toBeCloseTo(patched.userScore);
    expect(later.reputationDelta).toBe(0);
  });

  it("patching resumes support and halts the rot", () => {
    const rotting = weeks(abandon(brokenLaunch()), 5);
    const rescued = weeks(applyPatch(rotting), 5);
    expect(rescued.support).toBe("supported");
    expect(rescued.userScore).toBeGreaterThan(rotting.userScore);
  });
});

describe("the re-review event (§7.9)", () => {
  it("a major update partially adjusts the critic score toward the new verdict", () => {
    const launch = workedExampleLaunch();
    const improved = applyContentUpdate(applyPatch(applyPatch(launch)));
    const fresh = reviewCritics(
      {
        axes: improved.axes,
        q: improved.q,
        expectation: improved.expectation,
        context: improved.context,
      },
      OUTLETS,
      noNoise,
    );
    const reReviewed = reReviewMajorUpdate(improved, OUTLETS, noNoise);
    // Partial: strictly between the locked launch score and the fresh verdict.
    expect(fresh.metascore).toBeGreaterThan(launch.metascore);
    expect(reReviewed.metascore).toBeGreaterThan(launch.metascore);
    expect(reReviewed.metascore).toBeLessThan(fresh.metascore);
  });

  it("a re-review with nothing new barely moves the needle", () => {
    const launch = workedExampleLaunch();
    const reReviewed = reReviewMajorUpdate(launch, OUTLETS, noNoise);
    expect(Math.abs(reReviewed.metascore - launch.metascore)).toBeLessThan(1);
  });
});

describe("state discipline", () => {
  it("all updates are immutable — the input state is never touched", () => {
    const launch = workedExampleLaunch();
    const snapshot = structuredClone(launch);
    applyPatch(launch);
    applyContentUpdate(launch);
    advanceWeek(abandon(launch));
    reReviewMajorUpdate(launch, OUTLETS, noNoise);
    expect(launch).toEqual(snapshot);
  });
});
