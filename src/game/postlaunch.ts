/**
 * Post-launch score movement — GDD §7.9 (§15 step 9).
 *
 * Reception is a second act, not a verdict. A released game carries a
 * ReceptionState that moves in weekly time steps and through explicit
 * support actions:
 *
 *   - applyPatch:          repairs launch Polish (diminishing returns toward
 *                          a cap) → the user score climbs (the redemption arc)
 *   - applyContentUpdate:  DLC/updates raise Content → Value → user score
 *   - abandon + advanceWeek: walking away from a *broken* game decays the
 *                          user score, community sentiment, and reputation
 *   - reReviewMajorUpdate: a major update triggers a re-review event that
 *                          partially adjusts the otherwise-locked critic score
 *
 * Critic scores are largely locked at launch (as in reality); only the
 * re-review event moves the Metascore, and only part of the way.
 *
 * All functions are pure: they take a state and return a new state.
 */

import { QUALITY_AXES, type AxisScores, type GenreWeights, type Outlet, type QualityAxis } from "./types";
import { clamp } from "./quality";
import {
  computeUserScore,
  reviewCritics,
  type ExpectationInputs,
  type ReviewContext,
  type Rng,
} from "./reviews";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

export const POSTLAUNCH_TUNING = {
  /** Fraction of the remaining headroom (to the cap) each patch recovers. */
  PATCH_POLISH_RECOVERY: 0.5,
  /** Patches can't polish past this — some launch damage is structural. */
  PATCH_POLISH_CAP: 95,
  /** Visible commitment: each patch buys back community goodwill. */
  PATCH_SENTIMENT_BUMP: 5,

  /** Fraction of remaining Content headroom a full-size (100) DLC adds. */
  DLC_CONTENT_RECOVERY: 0.35,
  DLC_SENTIMENT_BUMP: 2,

  /** Below this launch Polish the game counts as broken (§7.9 abandonment). */
  BROKEN_POLISH_BAR: 70,
  ABANDON_USER_DECAY_PER_WEEK: 0.6,
  ABANDON_SENTIMENT_DECAY_PER_WEEK: 1,
  ABANDON_REPUTATION_DECAY_PER_WEEK: 0.15,

  /** How far a re-review moves the Metascore toward what the game now deserves. */
  RE_REVIEW_WEIGHT: 0.4,
} as const;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** The living reception of a released game (§7.9). */
export interface ReceptionState {
  /** Current effective axes; Polish and Content move post-launch. */
  axes: AxisScores;
  /** Objective quality, re-derived as the axes move. */
  q: number;
  genreProfile: GenreWeights;
  /** Launch-time expectation/context, kept for re-review events. */
  expectation: ExpectationInputs;
  context: ReviewContext;
  price: number;
  /** Community goodwill, 0–100 (a user-score input, §7.8). */
  sentiment: number;
  /** Launch hype gap (q − ExpectedQuality at launch); backlash lingers. */
  gap: number;
  /** Largely locked at launch; only reReviewMajorUpdate moves it. */
  metascore: number;
  userScore: number;
  weeksSinceLaunch: number;
  support: "supported" | "abandoned";
  /** Accumulated decay applied on top of the modeled user score. */
  userScoreDrift: number;
  /** Cumulative post-launch reputation effect, for the studio layer to consume. */
  reputationDelta: number;
}

/** What the launch pipeline hands over (subset of CriticReception + inputs). */
export interface LaunchSnapshot {
  axes: AxisScores;
  q: number;
  genreProfile: GenreWeights;
  expectation: ExpectationInputs;
  context: ReviewContext;
  gap: number;
  metascore: number;
  price: number;
  sentiment?: number;
}

export function createReceptionState(launch: LaunchSnapshot): ReceptionState {
  const sentiment = launch.sentiment ?? 50;
  const state: ReceptionState = {
    axes: { ...launch.axes },
    q: launch.q,
    genreProfile: { ...launch.genreProfile },
    expectation: { ...launch.expectation },
    context: { ...launch.context },
    price: launch.price,
    sentiment,
    gap: launch.gap,
    metascore: launch.metascore,
    userScore: 0,
    weeksSinceLaunch: 0,
    support: "supported",
    userScoreDrift: 0,
    reputationDelta: 0,
  };
  state.userScore = modeledUserScore(state);
  return state;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The §7.8 user model evaluated on the *current* state, plus any decay drift. */
function modeledUserScore(state: ReceptionState): number {
  const modeled = computeUserScore({
    axes: state.axes,
    q: state.q,
    gap: state.gap,
    price: state.price,
    sentiment: state.sentiment,
  });
  return clamp(modeled + state.userScoreDrift, 0, 100);
}

/** Moves one axis and re-derives Q by that axis's share of the genre profile. */
function withAxisDelta(state: ReceptionState, axis: QualityAxis, delta: number): ReceptionState {
  const newValue = clamp(state.axes[axis] + delta, 0, 100);
  const applied = newValue - state.axes[axis];
  const totalWeight = QUALITY_AXES.reduce((s, a) => s + state.genreProfile[a], 0);
  return {
    ...state,
    axes: { ...state.axes, [axis]: newValue },
    q: clamp(state.q + applied * (state.genreProfile[axis] / totalWeight), 0, 100),
  };
}

// ---------------------------------------------------------------------------
// Support actions (§7.9)
// ---------------------------------------------------------------------------

/** Patch: repairs launch Polish with diminishing returns → user score climbs. */
export function applyPatch(state: ReceptionState): ReceptionState {
  const t = POSTLAUNCH_TUNING;
  const headroom = Math.max(0, t.PATCH_POLISH_CAP - state.axes.polish);
  let next = withAxisDelta(state, "polish", headroom * t.PATCH_POLISH_RECOVERY);
  next = {
    ...next,
    sentiment: clamp(next.sentiment + t.PATCH_SENTIMENT_BUMP, 0, 100),
    support: "supported",
  };
  return { ...next, userScore: modeledUserScore(next) };
}

/** DLC/content update: raises Content (→ Value) and re-engages the market. */
export function applyContentUpdate(state: ReceptionState, size = 100): ReceptionState {
  const t = POSTLAUNCH_TUNING;
  const headroom = Math.max(0, 100 - state.axes.content);
  const gain = headroom * t.DLC_CONTENT_RECOVERY * (clamp(size, 0, 100) / 100);
  let next = withAxisDelta(state, "content", gain);
  next = {
    ...next,
    sentiment: clamp(next.sentiment + t.DLC_SENTIMENT_BUMP, 0, 100),
    support: "supported",
  };
  return { ...next, userScore: modeledUserScore(next) };
}

/** Walk away. Harmless for a healthy game; a broken one starts to decay (§7.9). */
export function abandon(state: ReceptionState): ReceptionState {
  return { ...state, support: "abandoned" };
}

/**
 * One week of elapsed time. An abandoned *broken* game (Polish below the bar)
 * bleeds user score, sentiment, and studio reputation; anything else holds.
 */
export function advanceWeek(state: ReceptionState): ReceptionState {
  const t = POSTLAUNCH_TUNING;
  let next: ReceptionState = { ...state, weeksSinceLaunch: state.weeksSinceLaunch + 1 };
  if (state.support === "abandoned" && state.axes.polish < t.BROKEN_POLISH_BAR) {
    next = {
      ...next,
      userScoreDrift: next.userScoreDrift - t.ABANDON_USER_DECAY_PER_WEEK,
      sentiment: clamp(next.sentiment - t.ABANDON_SENTIMENT_DECAY_PER_WEEK, 0, 100),
      reputationDelta: next.reputationDelta - t.ABANDON_REPUTATION_DECAY_PER_WEEK,
    };
  }
  return { ...next, userScore: modeledUserScore(next) };
}

/**
 * The re-review event (§7.9): after a major update, critics take another
 * look. The full §7.5 pipeline is re-run on the *current* axes/Q, and the
 * locked launch Metascore moves partially toward the new verdict.
 */
export function reReviewMajorUpdate(
  state: ReceptionState,
  outlets: Outlet[],
  rng: Rng,
): ReceptionState {
  const fresh = reviewCritics(
    {
      axes: state.axes,
      q: state.q,
      expectation: state.expectation,
      context: state.context,
    },
    outlets,
    rng,
  );
  const metascore = clamp(
    state.metascore + POSTLAUNCH_TUNING.RE_REVIEW_WEIGHT * (fresh.metascore - state.metascore),
    0,
    100,
  );
  return { ...state, metascore };
}
