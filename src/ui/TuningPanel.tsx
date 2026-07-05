import { useState, useSyncExternalStore } from "react";
import {
  DEFAULT_TUNING,
  applyDifficulty,
  getDifficulty,
  getTuning,
  resetTuning,
  setTuning,
  subscribeTuning,
  tuningVersion,
  type Difficulty,
  type TuningConfig,
} from "../game/config";
import { expectationMod } from "../game/reviews";
import { useLoopStore } from "../state/loopStore";

interface Dial {
  key: keyof TuningConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}

const DIALS: Dial[] = [
  { key: "expectationKDown", label: "Expectation k (punish)", min: 0, max: 0.4, step: 0.01 },
  { key: "expectationKUp", label: "Expectation k (reward)", min: 0, max: 0.2, step: 0.01 },
  { key: "expectationScale", label: "Expectation scale", min: 10, max: 60, step: 1 },
  { key: "outletVarianceScale", label: "Outlet variance", min: 0, max: 3, step: 0.1 },
  { key: "overscopeSteepness", label: "Overscope steepness", min: 0, max: 0.8, step: 0.05 },
  { key: "trendCycleSpeed", label: "Trend cycle speed", min: 0.2, max: 3, step: 0.1 },
  { key: "marketVolatility", label: "Market volatility", min: 0, max: 3, step: 0.1 },
  { key: "burnRate", label: "Burn rate (payroll)", min: 0.5, max: 2, step: 0.05 },
  { key: "crunchToll", label: "Crunch toll", min: 0, max: 2.5, step: 0.1 },
  { key: "recoveryRate", label: "Recovery rate", min: 0, max: 3, step: 0.1 },
  { key: "startingCash", label: "Starting cash (restart)", min: 10_000, max: 200_000, step: 5_000 },
];

const DIFFICULTIES: Difficulty[] = ["cozy", "standard", "brutal"];

/** Dev-only §15 dial board. Stripped from production builds. */
export default function TuningPanel() {
  useSyncExternalStore(subscribeTuning, tuningVersion);
  const [open, setOpen] = useState(false);
  const restart = useLoopStore((s) => s.restart);

  if (!import.meta.env.DEV) return null;
  const t = getTuning();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-20 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 shadow-lg hover:border-amber-400"
      >
        ⚙ tuning
      </button>
    );
  }

  return (
    <aside className="fixed bottom-4 right-4 z-20 max-h-[85vh] w-80 space-y-3 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-400">
          §15 tuning dials <span className="text-zinc-500">(dev)</span>
        </p>
        <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
          ✕
        </button>
      </div>

      {/* §12 difficulty tiers */}
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Difficulty (§12)</p>
        <div className="flex gap-1">
          {DIFFICULTIES.map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => applyDifficulty(tier)}
              className={`flex-1 rounded-md border px-2 py-1 text-xs capitalize ${
                getDifficulty() === tier
                  ? "border-amber-400 bg-amber-400/15 text-amber-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-600">
          Tunes expectation steepness, volatility, and cash cushion — never stats.
        </p>
      </div>

      {/* Live effect readout */}
      <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2 text-[11px] text-zinc-400">
        <p>
          ExpectationMod at gap −15: ×{expectationMod(-15).toFixed(3)} · at +15: ×
          {expectationMod(15).toFixed(3)}
        </p>
      </div>

      {/* The dials */}
      <div className="space-y-2">
        {DIALS.map((dial) => {
          const value = t[dial.key];
          const isDefault = value === DEFAULT_TUNING[dial.key];
          return (
            <label key={dial.key} className="block text-xs">
              <span className={`flex justify-between ${isDefault ? "text-zinc-400" : "text-amber-300"}`}>
                <span>{dial.label}</span>
                <span className="tabular-nums">
                  {dial.key === "startingCash" ? `$${value.toLocaleString()}` : value}
                </span>
              </span>
              <input
                type="range"
                min={dial.min}
                max={dial.max}
                step={dial.step}
                value={value}
                onChange={(e) => setTuning({ [dial.key]: Number(e.target.value) })}
                className="w-full accent-amber-400"
              />
            </label>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={resetTuning}
          className="flex-1 rounded-md border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
        >
          Reset dials
        </button>
        <button
          type="button"
          onClick={restart}
          className="flex-1 rounded-md border border-red-500/50 px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
        >
          Restart campaign
        </button>
      </div>
      <p className="text-[11px] text-zinc-600">
        Dials apply to the next computation (estimates update live); starting cash needs a
        restart.
      </p>
    </aside>
  );
}
