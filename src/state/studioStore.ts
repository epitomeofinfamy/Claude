/**
 * Zustand stores live in src/state/ — the bridge between pure game logic
 * (src/game/) and the React UI (src/ui/). Stores may call game logic;
 * game logic never imports from here.
 */

import { create } from "zustand";
import type { Ip } from "../game/types";

interface StudioState {
  studioName: string;
  cash: number;
  reputation: number;
  /** In-game year; the campaign starts in a garage in 1985 (GDD §1). */
  year: number;
  /** Shipped franchises available for sequels (GDD §10); empty at the start. */
  ipCatalog: Ip[];
  setStudioName: (name: string) => void;
}

export const useStudioStore = create<StudioState>()((set) => ({
  studioName: "Garage Games",
  cash: 20_000,
  reputation: 0,
  year: 1985,
  ipCatalog: [],
  setStudioName: (name) => set({ studioName: name }),
}));
