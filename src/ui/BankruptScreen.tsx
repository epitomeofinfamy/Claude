import { useLoopStore } from "../state/loopStore";

export default function BankruptScreen() {
  const studio = useLoopStore((s) => s.state.studio);
  const game = useLoopStore((s) => s.state.game);
  const restart = useLoopStore((s) => s.restart);

  return (
    <div className="mx-auto max-w-xl space-y-6 text-center">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-red-400">Bankrupt</p>
        <h1 className="text-4xl font-black">{studio.name} closes its doors.</h1>
        <p className="text-zinc-400">
          The money ran out{game ? ` chasing ${game.title}` : ""} — $
          {studio.cash.toLocaleString()} in the bank, {studio.staff.length} people owed a
          paycheck. The boom-bust cycle is real; that's what makes the other ending worth
          reaching.
        </p>
      </header>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
        <p>
          Final reputation {Math.round(studio.reputation)} · {studio.ipCatalog.length} IP
          {studio.ipCatalog.length === 1 ? "" : "s"} · {studio.year}
        </p>
      </div>

      <button
        type="button"
        onClick={restart}
        className="rounded-md bg-amber-400 px-6 py-2.5 text-lg font-bold text-zinc-950 hover:bg-amber-300"
      >
        Start over — 1985, a garage, an idea
      </button>
    </div>
  );
}
