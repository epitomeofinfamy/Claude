/**
 * Conception-screen store: holds only the player's in-progress concept
 * draft. Validation and greenlighting live in the game logic; the actual
 * greenlight goes through the loop store.
 */

import { create } from "zustand";
import { EMPTY_DRAFT, type ConceptBasis, type ConceptDraft } from "../game/conception";
import type { Genre, Platform, ScopeTier, Topic } from "../game/types";

interface ConceptionState {
  draft: ConceptDraft;
  setTitle: (title: string) => void;
  setBasis: (basis: ConceptBasis) => void;
  toggleGenre: (genre: Genre) => void;
  setTopic: (topic: Topic) => void;
  togglePlatform: (platform: Platform) => void;
  setScopeTier: (tier: ScopeTier) => void;
  reset: () => void;
}

export const useConceptionStore = create<ConceptionState>()((set) => ({
  draft: EMPTY_DRAFT,

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

  reset: () => set({ draft: EMPTY_DRAFT }),
}));
