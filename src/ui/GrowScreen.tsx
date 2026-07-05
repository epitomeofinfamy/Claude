import { ECONOMY_TUNING, trainingCost } from "../game/economy";
import { useLoopStore } from "../state/loopStore";

export default function GrowScreen() {
  const state = useLoopStore((s) => s.state);
  const store = useLoopStore();
  const { game, growth, studio } = state;

  if (!game || !growth) return null;

  const engineCost = ECONOMY_TUNING.ENGINE_UPGRADE_COST;
  const trainCost = trainingCost(studio.staff.length);

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
          <p className="text-xs text-zinc-500">
            ${growth.bankedNow.toLocaleString()} now
            {growth.tail.length > 0 && ` · rest over ${growth.tail.length}q`}
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

      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Reinvest (§3: Grow)
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={studio.cash < engineCost}
            onClick={store.investInEngine}
            className="rounded-md border border-zinc-700 px-3 py-2 text-left text-sm hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <p className="font-medium">Engine R&D — ${engineCost.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">
              {studio.engines[0]?.name}: tech {studio.engines[0]?.techLevel} → +
              {ECONOMY_TUNING.ENGINE_UPGRADE_TECH_GAIN} (raises Presentation/Polish ceilings)
            </p>
          </button>
          <button
            type="button"
            disabled={studio.cash < trainCost}
            onClick={store.trainTeam}
            className="rounded-md border border-zinc-700 px-3 py-2 text-left text-sm hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <p className="font-medium">Training program — ${trainCost.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">
              Every specialist +{ECONOMY_TUNING.TRAINING_SKILL_GAIN} to their craft (salaries rise
              with skill)
            </p>
          </button>
        </div>
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
