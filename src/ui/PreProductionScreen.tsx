import { useState } from "react";
import { useLoopStore } from "../state/loopStore";

export default function PreProductionScreen() {
  const game = useLoopStore((s) => s.state.game);
  const studio = useLoopStore((s) => s.state.studio);
  const beginProduction = useLoopStore((s) => s.beginProduction);
  const [engineId, setEngineId] = useState(studio.engines[0]?.id ?? "");
  const [riskTaking, setRiskTaking] = useState(50);

  if (!game) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">
          Pre-production
        </p>
        <h1 className="text-3xl font-bold">{game.title}</h1>
        <p className="text-sm text-zinc-500">
          Pre-pro decisions ripple through everything downstream (§3).
        </p>
      </header>

      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Engine</h2>
        <div className="flex flex-wrap gap-2">
          {studio.engines.map((engine) => (
            <button
              key={engine.id}
              type="button"
              onClick={() => setEngineId(engine.id)}
              className={`rounded-md border px-3 py-2 text-left text-sm ${
                engineId === engine.id
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-zinc-700 hover:border-zinc-500"
              }`}
            >
              <p className="font-medium">{engine.name}</p>
              <p className="text-xs text-zinc-500">
                Tech level {engine.techLevel} — caps Presentation & Polish
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Creative risk
        </h2>
        <input
          type="range"
          min={0}
          max={100}
          value={riskTaking}
          onChange={(e) => setRiskTaking(Number(e.target.value))}
          className="w-full accent-amber-400"
        />
        <p className="text-sm text-zinc-400">
          {riskTaking} —{" "}
          {riskTaking >= 70
            ? "swing big; Innovation loves it, execution may not"
            : riskTaking >= 40
              ? "measured bets"
              : "play it safe; sequels beware iteration fatigue"}
        </p>
      </section>

      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">The team</h2>
        <ul className="grid grid-cols-2 gap-1 text-sm">
          {studio.staff.map((member) => (
            <li key={member.id} className="flex justify-between">
              <span>{member.name}</span>
              <span className="capitalize text-zinc-500">
                {member.specialty} {member.skills[member.specialty]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={() => beginProduction({ engineId, riskTaking })}
        className="rounded-md bg-amber-400 px-5 py-2 font-semibold text-zinc-950 hover:bg-amber-300"
      >
        Begin production
      </button>
    </div>
  );
}
