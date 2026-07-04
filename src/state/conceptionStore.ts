/**
 * Conception-screen store: holds the player's in-progress concept draft and
 * the greenlit Game. All rules live in src/game/conception.ts — this store
 * only sequences choices and supplies identifiers.
 */

import { create } from "zustand";
import {
  EMPTY_DRAFT,
  greenlightGame,
  validateConcept,
  type ConceptBasis,
  type ConceptDraft,
} from "../game/conception";
import type { Game, Genre, Platform, ScopeTier, Topic } from "../game/types";
import { useStudioStore } from "./studioStore";

let nextId = 1;

interface ConceptionState {
  draft: ConceptDraft;
  greenlitGame: Game | null;
  setTitle: (title: string) => void;
  setBasis: (basis: ConceptBasis) => void;
  toggleGenre: (genre: Genre) => void;
  setTopic: (topic: Topic) => void;
  togglePlatform: (platform: Platform) => void;
  setScopeTier: (tier: ScopeTier) => void;
  /** Validates and, if clean, produces the configured Game. Returns problems. */
  greenlight: () => string[];
  startOver: () => void;
}

export const useConceptionStore = create<ConceptionState>()((set, get) => ({
  draft: EMPTY_DRAFT,
  greenlitGame: null,

  setTitle: (title) => set((s) => ({ draft: { ...s.draft, title } })),
  setBasis: (basis) => set((s) => ({ draft: { ...s.draft, basis } })),
  setTopic: (topic) => set((s) => ({ draft: { ...s.draft, topic } })),
  setScopeTier: (scopeTier) => set((s) => ({ draft: { ...s.draft, scopeTier } })),

  toggleGenre: (genre) =>
    set((s) => {
      const has = s.draft.genres.includes(genre);
      const genres = has
        ? s.draft.genres.filter((g) => g !== genre)
        : s.draft.genres.length < 2
          ? [...s.draft.genres, genre]
          : s.draft.genres;
      return { draft: { ...s.draft, genres } };
    }),

  togglePlatform: (platform) =>
    set((s) => {
      const has = s.draft.platforms.includes(platform);
      const platforms = has
        ? s.draft.platforms.filter((p) => p !== platform)
        : [...s.draft.platforms, platform];
      return { draft: { ...s.draft, platforms } };
    }),

  greenlight: () => {
    const { draft } = get();
    const studio = useStudioStore.getState();
    const ipCatalog = studio.ipCatalog;
    const problems = validateConcept(draft, ipCatalog);
    if (problems.length > 0) return problems;
    const id = nextId++;
    const game = greenlightGame(draft, {
      gameId: `game-${id}`,
      newIpId: `ip-${id}`,
      engineId: "engine-1",
      releaseWindow: { year: studio.year, quarter: 4 },
      ipCatalog,
    });
    set({ greenlitGame: game });
    return [];
  },

  startOver: () => set({ draft: EMPTY_DRAFT, greenlitGame: null }),
}));
