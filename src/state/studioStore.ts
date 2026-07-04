/**
 * Zustand stores live in src/state/ — the bridge between pure game logic
 * (src/game/) and the React UI (src/ui/). Stores may call game logic;
 * game logic never imports from here.
 */

import { create } from "zustand";
import type { Engine, Ip, Specialty, Staff } from "../game/types";

function founder(
  id: string,
  name: string,
  specialty: Specialty,
  skill: number,
): Staff {
  return {
    id,
    name,
    specialty,
    skills: {
      designer: 20,
      programmer: 20,
      artist: 15,
      audio: 10,
      writer: 15,
      producer: 15,
      qa: 20,
      [specialty]: skill,
    },
    morale: 80,
    burnout: 10,
  };
}

interface StudioState {
  studioName: string;
  cash: number;
  reputation: number;
  /** In-game year; the campaign starts in a garage in 1985 (GDD §1). */
  year: number;
  /** Shipped franchises available for sequels (GDD §10); empty at the start. */
  ipCatalog: Ip[];
  /** The founding team crammed into the garage. */
  staff: Staff[];
  engines: Engine[];
  setStudioName: (name: string) => void;
  spendCash: (amount: number) => void;
}

export const useStudioStore = create<StudioState>()((set) => ({
  studioName: "Garage Games",
  cash: 20_000,
  reputation: 0,
  year: 1985,
  ipCatalog: [],
  staff: [
    founder("staff-1", "Alex Park", "designer", 65),
    founder("staff-2", "Sam Rios", "programmer", 60),
    founder("staff-3", "Jo Kimura", "artist", 60),
    founder("staff-4", "Ana Volkov", "writer", 55),
  ],
  engines: [{ id: "engine-1", name: "HomeBrew 1.0", techLevel: 25 }],
  setStudioName: (name) => set({ studioName: name }),
  spendCash: (amount) => set((s) => ({ cash: s.cash - amount })),
}));
