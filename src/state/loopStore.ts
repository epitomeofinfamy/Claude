/**
 * The one store that drives the game: a thin Zustand shell over the pure
 * §3 loop state machine in src/game/loop.ts. Every action delegates to a
 * machine transition with Math.random as the RNG; all rules live in game/.
 */

import { create } from "zustand";
import {
  advanceProduction,
  advanceReveal,
  beginProduction,
  completePostMortem,
  createLoop,
  enterShipDecision,
  finishReveal,
  greenlightConcept,
  hireStaff,
  investInEngine,
  launch,
  researchUnlock,
  resolveEvent,
  resolveStudioEvent,
  setAllocation,
  setCrunch,
  shipCrunch,
  shipCutScope,
  shipDelay,
  shipPolish,
  startNextProject,
  trainTeam,
  upgradeOffice,
  type LoopState,
  type PreProductionChoices,
  type StudioState,
} from "../game/loop";
import { startingResearch, type ResearchKind } from "../game/progression";
import { getTuning } from "../game/config";
import type { ConceptDraft } from "../game/conception";
import type { LaunchPlan } from "../game/shipdecision";
import type { Specialty, Workstream } from "../game/types";

function founder(id: string, name: string, specialty: Specialty, skill: number) {
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

/** 1985. A garage. Four believers, a homebrew engine, and the seed savings
 * that have to last until the first game pays out (GDD §1, §9). The cash
 * cushion comes from the difficulty config (§12). */
const initialStudio = (): StudioState => ({
  name: "Garage Games",
  cash: getTuning().startingCash,
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
  offices: "garage",
  research: startingResearch(),
});

interface LoopStore {
  state: LoopState;
  greenlight: (draft: ConceptDraft) => void;
  beginProduction: (choices: PreProductionChoices) => void;
  setAllocation: (workstream: Workstream, value: number) => void;
  setCrunch: (crunching: boolean) => void;
  advanceProduction: () => void;
  resolveEvent: (optionId: string) => void;
  enterShipDecision: () => void;
  shipPolish: () => void;
  shipCrunch: () => void;
  shipCutScope: () => void;
  shipDelay: () => void;
  launch: (plan: LaunchPlan) => void;
  advanceReveal: () => void;
  finishReveal: () => void;
  completePostMortem: () => void;
  resolveStudioEvent: (optionId: string) => void;
  investInEngine: () => void;
  trainTeam: () => void;
  upgradeOffice: () => void;
  researchUnlock: (kind: ResearchKind, id: string) => void;
  hireStaff: (specialty: Specialty) => void;
  startNextProject: () => void;
  /** After bankruptcy: back to 1985, fresh garage. */
  restart: () => void;
}

export const useLoopStore = create<LoopStore>()((set) => {
  const apply = (transition: (s: LoopState) => LoopState) =>
    set((store) => ({ state: transition(store.state) }));

  return {
    state: createLoop(initialStudio()),
    greenlight: (draft) => apply((s) => greenlightConcept(s, draft)),
    beginProduction: (choices) => apply((s) => beginProduction(s, choices)),
    setAllocation: (ws, value) => apply((s) => setAllocation(s, ws, value)),
    setCrunch: (crunching) => apply((s) => setCrunch(s, crunching)),
    advanceProduction: () => apply((s) => advanceProduction(s, Math.random)),
    resolveEvent: (optionId) => apply((s) => resolveEvent(s, optionId, Math.random)),
    enterShipDecision: () => apply(enterShipDecision),
    shipPolish: () => apply(shipPolish),
    shipCrunch: () => apply((s) => shipCrunch(s, Math.random)),
    shipCutScope: () => apply(shipCutScope),
    shipDelay: () => apply(shipDelay),
    launch: (plan) => apply((s) => launch(s, plan, Math.random)),
    advanceReveal: () => apply(advanceReveal),
    finishReveal: () => apply(finishReveal),
    completePostMortem: () => apply((s) => completePostMortem(s, Math.random)),
    resolveStudioEvent: (optionId) => apply((s) => resolveStudioEvent(s, optionId)),
    investInEngine: () => apply(investInEngine),
    trainTeam: () => apply(trainTeam),
    upgradeOffice: () => apply(upgradeOffice),
    researchUnlock: (kind, id) => apply((s) => researchUnlock(s, kind, id)),
    hireStaff: (specialty) => apply((s) => hireStaff(s, specialty)),
    startNextProject: () => apply(startNextProject),
    restart: () => set({ state: createLoop(initialStudio()) }),
  };
});
