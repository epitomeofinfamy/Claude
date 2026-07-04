/**
 * Production store: drives a ProductionRunState through milestones. All
 * simulation rules live in src/game/milestones.ts — this store sequences
 * player commands, supplies the RNG, and settles costs with the studio.
 */

import { create } from "zustand";
import {
  advanceMilestone,
  createProductionRun,
  resolveProductionEvent,
  type ProductionNotice,
  type ProductionRunState,
} from "../game/milestones";
import type { Game, Workstream } from "../game/types";
import { useStudioStore } from "./studioStore";

interface ProductionState {
  game: Game | null;
  run: ProductionRunState | null;
  /** Notices from the most recent action, newest first. */
  notices: ProductionNotice[];
  start: (game: Game) => void;
  setAllocation: (workstream: Workstream, value: number) => void;
  toggleCrunch: () => void;
  advance: () => void;
  resolveEvent: (optionId: string) => void;
  abandonProject: () => void;
}

export const useProductionStore = create<ProductionState>()((set, get) => ({
  game: null,
  run: null,
  notices: [],

  start: (game) => {
    const staff = useStudioStore.getState().staff;
    set({ game, run: createProductionRun(game.scopeTier, staff), notices: [] });
  },

  setAllocation: (workstream, value) =>
    set((s) =>
      s.run
        ? { run: { ...s.run, allocation: { ...s.run.allocation, [workstream]: value } } }
        : {},
    ),

  toggleCrunch: () =>
    set((s) => (s.run ? { run: { ...s.run, crunching: !s.run.crunching } } : {})),

  advance: () => {
    const { run } = get();
    if (!run) return;
    const result = advanceMilestone(run, Math.random);
    set({ run: result.run, notices: [...result.notices].reverse() });
  },

  resolveEvent: (optionId) => {
    const { run } = get();
    if (!run) return;
    const before = run.cashSpent;
    const result = resolveProductionEvent(run, optionId, Math.random);
    const spent = result.run.cashSpent - before;
    if (spent > 0) useStudioStore.getState().spendCash(spent);
    set({ run: result.run, notices: [...result.notices].reverse() });
  },

  abandonProject: () => set({ game: null, run: null, notices: [] }),
}));
