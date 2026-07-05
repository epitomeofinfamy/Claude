/**
 * Save/load serialization. The full LoopState is plain JSON data by
 * construction (no functions, dates, or class instances anywhere in the
 * machine), so a save is the state plus the tuning dials and difficulty it
 * was played under, wrapped with a version for future migrations.
 *
 * Pure string↔object logic only — the localStorage side lives in the state
 * layer (loopStore), keeping this testable in node.
 */

import type { LoopState } from "./loop";
import { getDifficulty, getTuning, type Difficulty, type TuningConfig } from "./config";

export const SAVE_VERSION = 1;

export interface SaveFile {
  version: number;
  savedAt: string;
  difficulty: Difficulty;
  tuning: TuningConfig;
  state: LoopState;
}

export function buildSave(state: LoopState, now: Date = new Date()): SaveFile {
  return {
    version: SAVE_VERSION,
    savedAt: now.toISOString(),
    difficulty: getDifficulty(),
    tuning: { ...getTuning() },
    state,
  };
}

export function serializeSave(state: LoopState, now?: Date): string {
  return JSON.stringify(buildSave(state, now));
}

/**
 * Parses and migrates a save. Returns null for anything unusable —
 * corrupt JSON, wrong shape, or a version this build can't migrate.
 */
export function parseSave(json: string): SaveFile | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  return migrate(raw as Record<string, unknown>);
}

/**
 * The migration ladder: each case upgrades one version toward current.
 * (Only v1 exists today; when the state shape changes, bump SAVE_VERSION
 * and add a case that rewrites the previous shape.)
 */
function migrate(raw: Record<string, unknown>): SaveFile | null {
  switch (raw.version) {
    case SAVE_VERSION:
      return isValidSave(raw) ? (raw as unknown as SaveFile) : null;
    default:
      return null; // unknown or newer than this build — refuse, don't guess
  }
}

/** Cheap structural sanity check before trusting a parsed save. */
function isValidSave(raw: Record<string, unknown>): boolean {
  const state = raw.state as LoopState | undefined;
  return (
    typeof raw.savedAt === "string" &&
    typeof raw.difficulty === "string" &&
    typeof raw.tuning === "object" &&
    raw.tuning !== null &&
    typeof state === "object" &&
    state !== null &&
    typeof state.phase === "string" &&
    typeof state.studio === "object" &&
    state.studio !== null &&
    Array.isArray(state.studio.staff) &&
    typeof state.market === "object"
  );
}
