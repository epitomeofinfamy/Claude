import { useStudioStore } from "../state/studioStore";
import { useProductionStore } from "../state/productionStore";
import { useShipStore } from "../state/shipStore";
import ConceptionScreen from "./ConceptionScreen";
import ProductionBoard from "./ProductionBoard";
import ShipDecisionScreen from "./ShipDecisionScreen";
import RevealScreen from "./RevealScreen";

export default function App() {
  const studioName = useStudioStore((s) => s.studioName);
  const cash = useStudioStore((s) => s.cash);
  const year = useStudioStore((s) => s.year);
  const inProduction = useProductionStore((s) => s.run !== null);
  const shipping = useShipStore((s) => s.ship !== null);
  const revealed = useShipStore((s) => s.result !== null);

  const screen = revealed ? (
    <RevealScreen />
  ) : shipping ? (
    <ShipDecisionScreen />
  ) : inProduction ? (
    <ProductionBoard />
  ) : (
    <ConceptionScreen />
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-2xl items-baseline justify-between px-4 py-3">
          <span className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">
            Going Gold
          </span>
          <span className="text-sm text-zinc-400">
            {studioName} · {year} · ${cash.toLocaleString()}
          </span>
        </div>
      </header>
      <main className="px-4 py-8">{screen}</main>
    </div>
  );
}
