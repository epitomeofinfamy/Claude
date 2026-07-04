import { useStudioStore } from "../state/studioStore";
import ConceptionScreen from "./ConceptionScreen";

export default function App() {
  const studioName = useStudioStore((s) => s.studioName);
  const cash = useStudioStore((s) => s.cash);
  const year = useStudioStore((s) => s.year);

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
      <main className="px-4 py-8">
        <ConceptionScreen />
      </main>
    </div>
  );
}
