import { useSyncExternalStore } from "react";
import { subscribeTuning, tuningVersion } from "../game/config";
import { useLoopStore } from "../state/loopStore";
import ConceptionScreen from "./ConceptionScreen";
import TuningPanel from "./TuningPanel";
import PreProductionScreen from "./PreProductionScreen";
import ProductionBoard from "./ProductionBoard";
import ShipDecisionScreen from "./ShipDecisionScreen";
import ReceptionScreen from "./ReceptionScreen";
import PostMortemScreen from "./PostMortemScreen";
import GrowScreen from "./GrowScreen";
import BankruptScreen from "./BankruptScreen";
import StudioDashboard from "./StudioDashboard";
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
  bankrupt: BankruptScreen,
};

export default function App() {
  const phase = useLoopStore((s) => s.state.phase);
  const studio = useLoopStore((s) => s.state.studio);
  const market = useLoopStore((s) => s.state.market);
  const restart = useLoopStore((s) => s.restart);
  // Re-render the whole tree when a tuning dial moves, so every estimate
  // and preview recomputes against the live config (dev tuning panel).
  useSyncExternalStore(subscribeTuning, tuningVersion);
  const Screen = SCREENS[phase];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-baseline justify-between px-4 py-3">
          <span className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">
            Going Gold
          </span>
          <span className="text-sm tabular-nums text-zinc-400">
            {studio.name} · Q{market.quarter} {market.year} ·{" "}
            <span className={studio.cash < 15_000 ? "text-red-300" : ""}>
              ${studio.cash.toLocaleString()}
            </span>{" "}
            · rep {Math.round(studio.reputation)}
            <button
              type="button"
              title="Wipe the save and start over in 1985"
              onClick={() => {
                if (window.confirm("Abandon this studio and start a new campaign?")) restart();
              }}
              className="ml-3 text-xs text-zinc-600 underline-offset-2 hover:text-zinc-300 hover:underline"
            >
              new game
            </button>
          </span>
        </div>
      </header>
      <main className="space-y-8 px-4 py-8">
        {phase === "conceive" && <StudioDashboard />}
        <Screen />
      </main>
      <TuningPanel />
    </div>
  );
}
