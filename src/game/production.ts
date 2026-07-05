/**
 * Axis production — GDD §7.3.
 *
 * Turns what the player actually did during production (workstream effort,
 * assigned staff skill, engine level, scope pressure, corners cut) into the
 * six axis scores and the objective quality Q:
 *
 *   AxisScore = clamp(
 *       BaseFromEffort(workstream_effort, assigned_staff_skill)
 *       × TechFactor        // Presentation/Polish are capped by engine level
 *       × GenreFitFactor    // did you emphasize what this genre needs?
 *       × ScopeFactor       // was the ambition supported by time/team?
 *       − CutCornerPenalty  // features cut, bugs shipped, crunch damage
 *       , 0, 100)
 *
 * Workstream → axis mapping (GDD §5): Gameplay → Gameplay · Content → Content
 * · Art + Audio → Presentation · Narrative → Narrative · Polish/QA → Polish ·
 * Tech → raises the Presentation/Polish ceiling. Innovation has no workstream:
 * it is fed by deliberate risk-taking (GDD §7.2), carried by design skill.
 * Sequel/novelty effects on Innovation belong to the §7.6 context modifiers,
 * not to production.
 *
 * All functions are pure and deterministic — no randomness here by design;
 * outlet variance enters later, in the §7.5 review pipeline.
 */

import {
  QUALITY_AXES,
  type AxisScores,
  type GenreWeights,
  type QualityAxis,
  type Workstream,
} from "./types";
import { clamp, computeQuality } from "./quality";
import { getTuning } from "./config";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/**
 * The dials that shape how production feels. The overscope penalty
 * steepness — one of the four §15 first-order knobs — lives in config.ts
 * and is read at computation time.
 */
export const PRODUCTION_TUNING = {
  /** Exponent < 1 on effort: diminishing returns on piling effort into one place. */
  EFFORT_CURVE: 0.75,
  /** Fraction of output unskilled staff still produce (skill scales the rest). */
  SKILL_FLOOR: 0.35,
  /** Art vs. audio split when the two workstreams blend into Presentation. */
  ART_SHARE_OF_PRESENTATION: 0.6,

  /** TechFactor at tech 0 — a garage engine still renders *something*. */
  TECH_FACTOR_FLOOR: 0.4,
  /** How much the tech workstream can shift the engine's effective level (§5). */
  TECH_WORKSTREAM_WEIGHT: 0.3,

  /** GenreFitFactor at a perfect effort-to-profile match. */
  GENRE_FIT_MAX_BONUS: 0.08,
  /** How fast the fit bonus decays into a penalty as effort misallocates. */
  GENRE_FIT_SPAN: 0.28,

  /** Exponent > 1: mild overreach is cheap, wild overreach is brutal. */
  OVERSCOPE_EXPONENT: 1.5,
  /** Risk above this level starts straining execution (§7.2: swings can miss). */
  RISK_PRESSURE_THRESHOLD: 50,
  /** Scope-pressure points per point of risk over the threshold. */
  RISK_EXECUTION_PRESSURE: 0.5,

  /** CutCornerPenalty points per input point (GDD §6: cuts hit Content, bugs hit Polish). */
  CUT_FEATURES_ON_CONTENT: 0.25,
  CUT_FEATURES_ON_OTHERS: 0.05,
  SHIPPED_BUGS_ON_POLISH: 0.3,
  SHIPPED_BUGS_ON_OTHERS: 0.05,
  CRUNCH_ON_ALL: 0.08,
} as const;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Effort allocated to a workstream and the average skill of staff on it (0–100 each). */
export interface WorkstreamInput {
  effort: number;
  skill: number;
}

/** Everything production hands to the axis formula (GDD §7.3). */
export interface ProductionInputs {
  workstreams: Record<Workstream, WorkstreamInput>;
  /** Deliberate creative risk, 0–100 — the production feed of Innovation (§7.2). */
  riskTaking: number;
  /** Engine tech level, 0–100; caps Presentation/Polish (§7.3). */
  engineTechLevel: number;
  /**
   * Scope-vs-time pressure, 0–100: 0 = ambition comfortably supported by
   * team and schedule, 100 = wildly over-scoped (§7.3 overscope penalty).
   */
  scopePressure: number;
  /** Corners cut on the way out the door (§6 ship-decision fallout), 0–100 each. */
  cutCorners: {
    featuresCut: number;
    shippedBugs: number;
    crunch: number;
  };
}

export interface ProductionResult {
  axes: AxisScores;
  /** Genre-weighted objective quality, 0–100 (§7.3). */
  q: number;
}

// ---------------------------------------------------------------------------
// Formula pieces (exported for targeted tests and later tuning)
// ---------------------------------------------------------------------------

/**
 * BaseFromEffort: what a workstream produces before any context factor.
 * Diminishing returns on effort; skill scales output above a floor.
 */
export function baseFromEffort(effort: number, skill: number): number {
  const { EFFORT_CURVE, SKILL_FLOOR } = PRODUCTION_TUNING;
  const e = clamp(effort, 0, 100) / 100;
  const s = clamp(skill, 0, 100) / 100;
  return 100 * Math.pow(e, EFFORT_CURVE) * (SKILL_FLOOR + (1 - SKILL_FLOOR) * s);
}

/**
 * TechFactor for Presentation/Polish. The engine sets the ceiling; the tech
 * workstream can push the effective level up or drag it down (§5, §7.3).
 */
export function techFactor(engineTechLevel: number, techWorkstreamBase: number): number {
  const { TECH_FACTOR_FLOOR, TECH_WORKSTREAM_WEIGHT } = PRODUCTION_TUNING;
  const effectiveTech =
    clamp(engineTechLevel, 0, 100) * (1 - TECH_WORKSTREAM_WEIGHT) +
    clamp(techWorkstreamBase, 0, 100) * TECH_WORKSTREAM_WEIGHT;
  return TECH_FACTOR_FLOOR + (1 - TECH_FACTOR_FLOOR) * (effectiveTech / 100);
}

/**
 * GenreFitFactor: compares how effort was *distributed* across the axes with
 * how the genre says it should be (§4 profile). A matched allocation earns a
 * small bonus; ignoring what the genre needs turns it into a penalty.
 * Neutral (1.0) when no effort has been allocated at all.
 */
export function genreFitFactor(
  axisEffort: Record<QualityAxis, number>,
  profile: GenreWeights,
): number {
  const { GENRE_FIT_MAX_BONUS, GENRE_FIT_SPAN } = PRODUCTION_TUNING;
  const totalEffort = QUALITY_AXES.reduce((s, a) => s + clamp(axisEffort[a], 0, 100), 0);
  const totalWeight = QUALITY_AXES.reduce((s, a) => s + profile[a], 0);
  if (totalEffort <= 0 || totalWeight <= 0) return 1;
  // Total-variation distance between effort shares and profile shares, 0–1.
  let misallocation = 0;
  for (const axis of QUALITY_AXES) {
    misallocation +=
      Math.abs(clamp(axisEffort[axis], 0, 100) / totalEffort - profile[axis] / totalWeight) / 2;
  }
  return 1 + GENRE_FIT_MAX_BONUS - GENRE_FIT_SPAN * misallocation;
}

/** ScopeFactor: the overscope penalty (§7.3), ≤ 1, steepening as pressure grows. */
export function scopeFactor(scopePressure: number): number {
  const p = clamp(scopePressure, 0, 100) / 100;
  return (
    1 - getTuning().overscopeSteepness * Math.pow(p, PRODUCTION_TUNING.OVERSCOPE_EXPONENT)
  );
}

/** CutCornerPenalty per axis: cut features hit Content, shipped bugs hit Polish, crunch hits everything. */
export function cutCornerPenalty(
  cutCorners: ProductionInputs["cutCorners"],
  axis: QualityAxis,
): number {
  const t = PRODUCTION_TUNING;
  const features = clamp(cutCorners.featuresCut, 0, 100);
  const bugs = clamp(cutCorners.shippedBugs, 0, 100);
  const crunch = clamp(cutCorners.crunch, 0, 100);
  return (
    features * (axis === "content" ? t.CUT_FEATURES_ON_CONTENT : t.CUT_FEATURES_ON_OTHERS) +
    bugs * (axis === "polish" ? t.SHIPPED_BUGS_ON_POLISH : t.SHIPPED_BUGS_ON_OTHERS) +
    crunch * t.CRUNCH_ON_ALL
  );
}

// ---------------------------------------------------------------------------
// The axis-production function (GDD §7.3)
// ---------------------------------------------------------------------------

export function produceAxes(
  inputs: ProductionInputs,
  profile: GenreWeights,
): ProductionResult {
  const ws = inputs.workstreams;
  const { ART_SHARE_OF_PRESENTATION } = PRODUCTION_TUNING;

  // BaseFromEffort per axis, via the §5 workstream mapping.
  const base: AxisScores = {
    gameplay: baseFromEffort(ws.gameplay.effort, ws.gameplay.skill),
    content: baseFromEffort(ws.content.effort, ws.content.skill),
    presentation:
      ART_SHARE_OF_PRESENTATION * baseFromEffort(ws.art.effort, ws.art.skill) +
      (1 - ART_SHARE_OF_PRESENTATION) * baseFromEffort(ws.audio.effort, ws.audio.skill),
    narrative: baseFromEffort(ws.narrative.effort, ws.narrative.skill),
    // Innovation: risk-taking carried by design skill (§7.2).
    innovation: baseFromEffort(inputs.riskTaking, ws.gameplay.skill),
    polish: baseFromEffort(ws.polish.effort, ws.polish.skill),
  };

  // Effort distribution per axis, for the genre-fit comparison. The tech
  // workstream feeds ceilings, not an axis, so it stays out of the fit.
  const axisEffort: Record<QualityAxis, number> = {
    gameplay: ws.gameplay.effort,
    content: ws.content.effort,
    presentation:
      ART_SHARE_OF_PRESENTATION * ws.art.effort +
      (1 - ART_SHARE_OF_PRESENTATION) * ws.audio.effort,
    narrative: ws.narrative.effort,
    innovation: inputs.riskTaking,
    polish: ws.polish.effort,
  };

  const tech = techFactor(
    inputs.engineTechLevel,
    baseFromEffort(ws.tech.effort, ws.tech.skill),
  );
  const fit = genreFitFactor(axisEffort, profile);
  // Deliberate creative risk feeds Innovation but strains execution — big
  // swings can miss (§7.2). Without this, max-risk would be a solved combo.
  const riskStrain =
    Math.max(0, clamp(inputs.riskTaking, 0, 100) - PRODUCTION_TUNING.RISK_PRESSURE_THRESHOLD) *
    PRODUCTION_TUNING.RISK_EXECUTION_PRESSURE;
  const scope = scopeFactor(clamp(inputs.scopePressure + riskStrain, 0, 100));

  const axes = {} as AxisScores;
  for (const axis of QUALITY_AXES) {
    const techForAxis = axis === "presentation" || axis === "polish" ? tech : 1;
    axes[axis] = clamp(
      base[axis] * techForAxis * fit * scope - cutCornerPenalty(inputs.cutCorners, axis),
      0,
      100,
    );
  }

  return { axes, q: computeQuality(axes, profile) };
}
