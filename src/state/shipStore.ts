/**
 * Ship Decision store: sequences the §6 levers and the launch. All rules
 * live in src/game/shipdecision.ts; this store settles costs with the
 * studio and holds the launch plan + reveal result.
 */

import { create } from "zustand";
import {
  SHIP_TUNING,
  applyCrunchRound,
  applyCutScope,
  applyDelay,
  applyPolishRound,
  createShipDecisionState,
  launchGame,
  type LaunchPlan,
  type LaunchResult,
  type ShipDecisionState,
} from "../game/shipdecision";
import { blendGenreProfiles } from "../game/conception";
import { STUB_MARKET } from "../game/data/market";
import { OUTLETS } from "../game/data/outlets";
import type { Game } from "../game/types";
import type { ProductionRunState } from "../game/milestones";
import { useStudioStore } from "./studioStore";

interface ShipUiState {
  game: Game | null;
  ship: ShipDecisionState | null;
  plan: LaunchPlan;
  result: LaunchResult | null;
  begin: (game: Game, run: ProductionRunState) => void;
  polish: () => void;
  crunch: () => void;
  cutScope: () => void;
  delay: () => void;
  setPlan: (partial: Partial<LaunchPlan>) => void;
  launch: () => void;
  reset: () => void;
}

const DEFAULT_PLAN: LaunchPlan = {
  releaseWindow: { year: 1986, quarter: 1 },
  marketingHype: 40,
  price: 50,
  platforms: ["pc"],
};

export const useShipStore = create<ShipUiState>()((set, get) => ({
  game: null,
  ship: null,
  plan: DEFAULT_PLAN,
  result: null,

  begin: (game, run) =>
    set({
      game,
      ship: createShipDecisionState(run),
      plan: { ...DEFAULT_PLAN, platforms: [...game.platforms] },
      result: null,
    }),

  polish: () => applyLever((s) => applyPolishRound(s), set, get),
  crunch: () => applyLever((s) => applyCrunchRound(s, Math.random), set, get),
  cutScope: () => applyLever((s) => applyCutScope(s), set, get),
  delay: () => applyLever((s) => applyDelay(s), set, get),

  setPlan: (partial) => set((s) => ({ plan: { ...s.plan, ...partial } })),

  launch: () => {
    const { game, ship, plan } = get();
    if (!game || !ship) return;
    const studio = useStudioStore.getState();
    const sequelIp = game.isSequelOf
      ? studio.ipCatalog.find((ip) => ip.id === game.ipId)
      : undefined;
    const result = launchGame(ship, plan, {
      game,
      genreProfile: blendGenreProfiles(game.genres),
      market: STUB_MARKET,
      outlets: OUTLETS,
      engineTechLevel: studio.engines[0]?.techLevel ?? 20,
      riskTaking: 50,
      reputation: studio.reputation,
      sequelPedigree: sequelIp?.pedigree ?? 0,
      rng: Math.random,
    });
    studio.spendCash(plan.marketingHype * SHIP_TUNING.MARKETING_COST_PER_POINT);
    set({ result });
  },

  reset: () => set({ game: null, ship: null, plan: DEFAULT_PLAN, result: null }),
}));

function applyLever(
  lever: (s: ShipDecisionState) => ShipDecisionState,
  set: (partial: Partial<ShipUiState>) => void,
  get: () => ShipUiState,
) {
  const { ship } = get();
  if (!ship) return;
  const next = lever(ship);
  const spent = next.extraBudget - ship.extraBudget;
  if (spent > 0) useStudioStore.getState().spendCash(spent);
  set({ ship: next });
}
