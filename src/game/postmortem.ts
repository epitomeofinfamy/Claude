/**
 * The post-mortem — GDD §7.10.
 *
 * Translates the review math into plain language so the player learns the
 * system by playing it: pull-quotes derived from the axes, an axis-by-axis
 * breakdown vs. what the genre needed, named diagnoses, and the top user
 * complaints. It demystifies enough to improve, without printing the formula.
 *
 * Pure and deterministic: all text is assembled from the template tables
 * below, keyed to score bands and detected conditions — no free-form
 * generation, no randomness.
 */

import {
  QUALITY_AXES,
  type AxisScores,
  type GenreWeights,
  type QualityAxis,
} from "./types";
import { clamp } from "./quality";
import {
  USER_SCORE_TUNING,
  type CriticReception,
  type ReviewContext,
} from "./reviews";

// ---------------------------------------------------------------------------
// Thresholds (exported for tuning and tests)
// ---------------------------------------------------------------------------

export const POSTMORTEM_TUNING = {
  /** |axis − Q| beyond which an axis reads as over/under-performing. */
  AXIS_DELTA_BAND: 8,
  /** Profile weight ÷ mean weight above/below which an axis is (de)emphasized. */
  EMPHASIS_RATIO: 1.3,
  DEEMPHASIS_RATIO: 0.75,

  /** Axis bands for pull-quote fragments. */
  PRAISE_BAND: 75,
  PAN_BAND: 60,

  // --- Diagnosis triggers ---
  OVERSCOPED_PRESSURE: 60,
  UNDERPOLISHED_AXIS: 65,
  UNDERPOLISHED_BUGS: 40,
  OVERHYPED_GAP: -3,
  BIG_OVERHYPE_GAP: -15,
  PLATFORM_MISMATCH_FIT: 0.97,
  CRUNCH_DAMAGE: 50,
  /** Below this Q, the honest diagnosis is the game itself. */
  QUALITY_BAR: 60,
  /** At or above this Q, a weak landing is a context story, not a quality one. */
  STRONG_GAME_Q: 70,

  // --- User complaint severities ---
  COMPLAINT_BUG_POLISH_BAR: 70,
  COMPLAINT_VALUE_BAR: 60,
  COMPLAINT_FEATURES_CUT: 40,
} as const;

// ---------------------------------------------------------------------------
// Template tables (all player-facing text lives here)
// ---------------------------------------------------------------------------

export const AXIS_LABELS: Record<QualityAxis, string> = {
  gameplay: "Gameplay",
  content: "Content",
  presentation: "Presentation",
  narrative: "Narrative",
  innovation: "Innovation",
  polish: "Polish",
};

/** Per-axis pull-quote fragments: praise reads as a sentence opener, pan follows "but". */
export const PULL_QUOTE_FRAGMENTS: Record<QualityAxis, { praise: string; pan: string }> = {
  gameplay: {
    praise: "The moment-to-moment play is superb",
    pan: "the combat never evolves",
  },
  content: {
    praise: "Packed with things to do",
    pan: "there's shockingly little game here",
  },
  presentation: {
    praise: "Stunning to look at",
    pan: "it looks and sounds a generation behind",
  },
  narrative: {
    praise: "The writing carries it",
    pan: "the story is an afterthought",
  },
  innovation: {
    praise: "Genuinely unlike anything else this year",
    pan: "it plays it painfully safe",
  },
  polish: {
    praise: "Impeccably polished",
    pan: "bugs undermine it at every turn",
  },
};

/** Overall-verdict quote by Metascore band (lower bound → quote). */
export const VERDICT_QUOTES: ReadonlyArray<readonly [number, string]> = [
  [85, "An instant classic."],
  [70, "A good game that stops short of greatness."],
  [55, "A mixed bag."],
  [0, "Hard to recommend."],
];

export type DiagnosisId =
  | "over-scoped"
  | "under-polished"
  | "over-hyped"
  | "bad-window"
  | "iteration-fatigue"
  | "platform-mismatch"
  | "trend-fatigued"
  | "starved-genre-axis"
  | "crunch-damage"
  | "quality-shortfall";

export const DIAGNOSIS_TEMPLATES: Record<DiagnosisId, string> = {
  "over-scoped":
    "Over-scoped: the ambition outran the team and the schedule, and every axis paid for it.",
  "under-polished":
    "Under-polished: the game shipped rough, and launch-day bugs colored everything that followed.",
  "over-hyped":
    "Over-hyped: marketing promised more than the game delivered, and the expectation gap cut the scores.",
  "bad-window":
    "Bad release window: launching into a crowded calendar split attention and invited brutal comparisons.",
  "iteration-fatigue":
    "Sequel iteration fatigue: critics saw too little evolution from the previous entry.",
  "platform-mismatch":
    "Platform mismatch: this genre and audience were a poor fit for the platform it shipped on.",
  "trend-fatigued":
    "Tired trend: the market has moved on from this genre or topic for now.",
  "starved-genre-axis":
    "Genre needs unmet: {axes} — exactly what this genre is judged on — came up short.",
  "crunch-damage":
    "Crunch damage: the death march left fingerprints on the final build.",
  "quality-shortfall":
    "Quality shortfall: the honest read is that the game wasn't there yet.",
};

export type SummaryId =
  | "strong-game-weak-landing"
  | "clean-landing"
  | "quality-shortfall"
  | "mixed-result";

export const SUMMARY_TEMPLATES: Record<SummaryId, string> = {
  "strong-game-weak-landing":
    "The game was strong; hype and a rough landing — not quality — cost the score. Fix the launch, not the studio.",
  "clean-landing":
    "A strong game that landed where it deserved. Whatever you calibrated here, keep doing it.",
  "quality-shortfall":
    "The reception matched the build: the game needed more. The market read it correctly.",
  "mixed-result":
    "A mixed outcome with lessons on both sides: some of this was the game, some was the landing.",
};

export type ComplaintId = "launch-bugs" | "over-promised" | "poor-value" | "felt-unfinished";

export const COMPLAINT_TEMPLATES: Record<ComplaintId, string> = {
  "launch-bugs": "“Broken at launch — wait for patches.”",
  "over-promised": "“Nothing like the trailers.”",
  "poor-value": "“Not enough game for the price.”",
  "felt-unfinished": "“Feels like half a game — where's the rest?”",
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface AxisBreakdownEntry {
  axis: QualityAxis;
  score: number;
  /** Score − Q: how this axis sits relative to the game's own overall level. */
  delta: number;
  /** How much the genre cares about this axis (from the profile). */
  emphasis: "emphasized" | "neutral" | "de-emphasized";
  verdict: "over-performed" | "on-target" | "under-performed";
}

export interface Diagnosis {
  id: DiagnosisId;
  text: string;
}

export interface UserComplaint {
  id: ComplaintId;
  text: string;
  /** Relative loudness; complaints are returned sorted by it, descending. */
  severity: number;
}

export interface PostMortem {
  pullQuotes: string[];
  axisBreakdown: AxisBreakdownEntry[];
  diagnoses: Diagnosis[];
  summary: { id: SummaryId; text: string };
  userComplaints: UserComplaint[];
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface PostMortemInputs {
  axes: AxisScores;
  q: number;
  genreProfile: GenreWeights;
  reception: CriticReception;
  userScore: number;
  context: ReviewContext;
  /** Same 0–100 pressure that fed the §7.3 ScopeFactor. */
  scopePressure: number;
  cutCorners: { featuresCut: number; shippedBugs: number; crunch: number };
  /** Price positioning 0–100 (50 = standard), as in the user-score model. */
  price: number;
}

// ---------------------------------------------------------------------------
// The post-mortem (GDD §7.10)
// ---------------------------------------------------------------------------

export function generatePostMortem(inputs: PostMortemInputs): PostMortem {
  const t = POSTMORTEM_TUNING;
  const { axes, q, genreProfile, reception, context } = inputs;

  // --- (2) Axis breakdown vs. the genre's expected profile ---
  const meanWeight =
    QUALITY_AXES.reduce((s, a) => s + genreProfile[a], 0) / QUALITY_AXES.length;
  const axisBreakdown: AxisBreakdownEntry[] = QUALITY_AXES.map((axis) => {
    const delta = axes[axis] - q;
    const ratio = genreProfile[axis] / meanWeight;
    return {
      axis,
      score: axes[axis],
      delta,
      emphasis:
        ratio >= t.EMPHASIS_RATIO
          ? "emphasized"
          : ratio <= t.DEEMPHASIS_RATIO
            ? "de-emphasized"
            : "neutral",
      verdict:
        delta >= t.AXIS_DELTA_BAND
          ? "over-performed"
          : delta <= -t.AXIS_DELTA_BAND
            ? "under-performed"
            : "on-target",
    };
  });

  // --- (1) Pull-quotes from the axes ---
  const pullQuotes: string[] = [];
  const sorted = [...QUALITY_AXES].sort((a, b) => axes[b] - axes[a]);
  const best = sorted[0]!;
  const worst = sorted[sorted.length - 1]!;
  const praise = PULL_QUOTE_FRAGMENTS[best].praise;
  const pan = PULL_QUOTE_FRAGMENTS[worst].pan;
  if (axes[best] >= t.PRAISE_BAND && axes[worst] <= t.PAN_BAND) {
    pullQuotes.push(`${praise}, but ${pan}.`);
  } else if (axes[best] >= t.PRAISE_BAND) {
    pullQuotes.push(`${praise} — a confident piece of work.`);
  } else if (axes[worst] <= t.PAN_BAND) {
    pullQuotes.push(`${pan.charAt(0).toUpperCase()}${pan.slice(1)}, and it shows.`);
  } else {
    pullQuotes.push("Competent, rarely more.");
  }
  const verdict = VERDICT_QUOTES.find(([bar]) => reception.metascore >= bar);
  if (verdict) pullQuotes.push(verdict[1]);
  if (reception.gap <= t.OVERHYPED_GAP) {
    pullQuotes.push(
      reception.gap <= t.BIG_OVERHYPE_GAP
        ? "Believe none of the marketing."
        : "It doesn't quite live up to the hype.",
    );
  } else if (reception.gap >= -t.BIG_OVERHYPE_GAP) {
    pullQuotes.push("A quiet surprise that outperforms its modest promises.");
  }

  // --- (3) Diagnoses ---
  const diagnoses: Diagnosis[] = [];
  const add = (id: DiagnosisId, text = DIAGNOSIS_TEMPLATES[id]) =>
    diagnoses.push({ id, text });

  if (inputs.scopePressure >= t.OVERSCOPED_PRESSURE) add("over-scoped");
  if (axes.polish < t.UNDERPOLISHED_AXIS || inputs.cutCorners.shippedBugs >= t.UNDERPOLISHED_BUGS) {
    add("under-polished");
  }
  if (reception.gap <= t.OVERHYPED_GAP) add("over-hyped");
  if (context.windowCrowding === "crowded") add("bad-window");
  if (context.isSequel && axisBreakdown.find((e) => e.axis === "innovation")!.verdict === "under-performed") {
    add("iteration-fatigue");
  }
  if (context.platformFit < t.PLATFORM_MISMATCH_FIT) add("platform-mismatch");
  if (context.genreTrend === "fatigued" || context.topicTrend === "fatigued") {
    add("trend-fatigued");
  }
  const starved = axisBreakdown.filter(
    (e) => e.emphasis === "emphasized" && e.verdict === "under-performed",
  );
  if (starved.length > 0) {
    add(
      "starved-genre-axis",
      DIAGNOSIS_TEMPLATES["starved-genre-axis"].replace(
        "{axes}",
        starved.map((e) => AXIS_LABELS[e.axis]).join(", "),
      ),
    );
  }
  if (inputs.cutCorners.crunch >= t.CRUNCH_DAMAGE) add("crunch-damage");
  if (q < t.QUALITY_BAR) add("quality-shortfall");

  // --- Summary: was this the game, or the landing? ---
  const contextIds: DiagnosisId[] = [
    "over-hyped",
    "under-polished",
    "bad-window",
    "iteration-fatigue",
    "platform-mismatch",
    "trend-fatigued",
  ];
  const hasContextTrouble = diagnoses.some((d) => contextIds.includes(d.id));
  let summaryId: SummaryId;
  if (q < t.QUALITY_BAR) {
    summaryId = "quality-shortfall";
  } else if (q >= t.STRONG_GAME_Q && hasContextTrouble) {
    summaryId = "strong-game-weak-landing";
  } else if (q >= t.STRONG_GAME_Q && diagnoses.length === 0) {
    summaryId = "clean-landing";
  } else {
    summaryId = "mixed-result";
  }

  // --- (4) Top user complaints (usually launch bugs and value, §7.10) ---
  const complaints: UserComplaint[] = [];
  const polish = clamp(axes.polish, 0, 100);
  if (polish < t.COMPLAINT_BUG_POLISH_BAR) {
    complaints.push({
      id: "launch-bugs",
      text: COMPLAINT_TEMPLATES["launch-bugs"],
      severity:
        (t.COMPLAINT_BUG_POLISH_BAR - polish) + 0.2 * clamp(inputs.cutCorners.shippedBugs, 0, 100),
    });
  }
  const priceFactor =
    1 + USER_SCORE_TUNING.PRICE_VALUE_SPAN * ((50 - clamp(inputs.price, 0, 100)) / 100);
  const value = clamp(clamp(axes.content, 0, 100) * priceFactor, 0, 100);
  if (value < t.COMPLAINT_VALUE_BAR) {
    complaints.push({
      id: "poor-value",
      text: COMPLAINT_TEMPLATES["poor-value"],
      severity: t.COMPLAINT_VALUE_BAR - value,
    });
  }
  if (reception.gap <= t.OVERHYPED_GAP) {
    complaints.push({
      id: "over-promised",
      text: COMPLAINT_TEMPLATES["over-promised"],
      severity: -reception.gap * 1.2,
    });
  }
  if (inputs.cutCorners.featuresCut >= t.COMPLAINT_FEATURES_CUT) {
    complaints.push({
      id: "felt-unfinished",
      text: COMPLAINT_TEMPLATES["felt-unfinished"],
      severity: 0.5 * clamp(inputs.cutCorners.featuresCut, 0, 100),
    });
  }
  complaints.sort((a, b) => b.severity - a.severity);

  return {
    pullQuotes,
    axisBreakdown,
    diagnoses,
    summary: { id: summaryId, text: SUMMARY_TEMPLATES[summaryId] },
    userComplaints: complaints.slice(0, 3),
  };
}
