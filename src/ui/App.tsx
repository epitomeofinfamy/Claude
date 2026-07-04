import { useLoopStore } from "../state/loopStore";
import ConceptionScreen from "./ConceptionScreen";
import PreProductionScreen from "./PreProductionScreen";
import ProductionBoard from "./ProductionBoard";
import ShipDecisionScreen from "./ShipDecisionScreen";
import ReceptionScreen from "./ReceptionScreen";
import PostMortemScreen from "./PostMortemScreen";
import GrowScreen from "./GrowScreen";
import type { LoopPhase } from "../game/loop";
import type { JSX } from "react";

const SCREENS: Record<LoopPhase, () => JSX.Element | null> = {
  conceive: ConceptionScreen,
  "pre-production": PreProductionScreen,
  production: ProductionBoard,
  ship: ShipDecisionScreen,
  reception: ReceptionScreen,
  "post-mortem": PostMortemScreen,
  grow: GrowScreen,
};

export default function App() {
  const phase = useLoopStore((s) => s.state.phase);
  const studio = useLoopStore((s) => s.state.studio);
  const Screen = SCREENS[phase];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-3xl items-baseline justify-between px-4 py-3">
          <span className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">
            Going Gold
          </span>
          <span className="text-sm text-zinc-400">
            {studio.name} · {studio.year} · ${studio.cash.toLocaleString()} · rep{" "}
            {Math.round(studio.reputation)}
          </span>
        </div>
      </header>
      <main className="px-4 py-8">
        <Screen />
      </main>
    </div>
  );
}
