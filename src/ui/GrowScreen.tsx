import { useLoopStore } from "../state/loopStore";

export default function GrowScreen() {
  const state = useLoopStore((s) => s.state);
  const store = useLoopStore();
  const { game, growth, studio } = state;

  if (!game || !growth) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">Grow</p>
        <h1 className="text-3xl font-bold">{game.title} — the ledger</h1>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Units sold</p>
          <p className="text-3xl font-black text-zinc-100">{growth.units.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Net revenue</p>
          <p className="text-3xl font-black text-emerald-300">
            ${growth.revenue.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Reputation</p>
          <p
            className={`text-3xl font-black ${
              growth.reputationDelta >= 0 ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {growth.reputationDelta >= 0 ? "+" : ""}
            {growth.reputationDelta.toFixed(1)}
          </p>
          <p className="text-xs text-zinc-500">now {Math.round(studio.reputation)}</p>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        {growth.ip && (
          <p className="text-sm text-amber-200">
            ★ {growth.ip.name} joins the IP catalog — pedigree {growth.ip.pedigree}. A sequel is
            on the table.
          </p>
        )}
        {growth.notes.map((note) => (
          <p key={note} className="text-sm text-zinc-400">
            {note}
          </p>
        ))}
        <p className="text-sm text-zinc-500">
          The team took some downtime. Bank: ${studio.cash.toLocaleString()}.
        </p>
      </section>

      <button
        type="button"
        onClick={store.startNextProject}
        className="rounded-md bg-amber-400 px-5 py-2 font-semibold text-zinc-950 hover:bg-amber-300"
      >
        Start the next project
      </button>
    </div>
  );
}
