import { useStudioStore } from "../state/studioStore";

export default function App() {
  const studioName = useStudioStore((s) => s.studioName);
  const cash = useStudioStore((s) => s.cash);
  const year = useStudioStore((s) => s.year);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100">
      <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">
        Going Gold
      </p>
      <h1 className="text-5xl font-bold">Hello, Studio</h1>
      <p className="text-zinc-400">
        {studioName} · {year} · ${cash.toLocaleString()} in the bank
      </p>
    </main>
  );
}
