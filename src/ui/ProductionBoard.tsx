import { QUALITY_AXES, WORKSTREAMS, type Staff } from "../game/types";
import {
  MILESTONE_TUNING,
  isProductionComplete,
  toProductionInputs,
} from "../game/milestones";
import { produceAxes } from "../game/production";
import { blendGenreProfiles } from "../game/conception";
import { projectEngine } from "../game/loop";
import { useLoopStore } from "../state/loopStore";

function Meter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 text-zinc-500">{label}</span>
      <div className="h-1.5 flex-1 rounded bg-zinc-800">
        <div
          className={`h-1.5 rounded ${tone}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="w-8 text-right text-zinc-400">{Math.round(value)}</span>
    </div>
  );
}

function StaffCard({ member }: { member: Staff }) {
  const burnoutHot = member.burnout >= MILESTONE_TUNING.BURNOUT_THRESHOLD;
  return (
    <div className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{member.name}</span>
        <span className="capitalize text-zinc-500">{member.specialty}</span>
      </div>
      <Meter label="Morale" value={member.morale} tone="bg-emerald-400" />
      <Meter
        label="Burnout"
        value={member.burnout}
        tone={burnoutHot ? "bg-red-500" : "bg-orange-400"}
      />
      {burnoutHot && <p className="text-xs text-red-400">At risk of quitting</p>}
    </div>
  );
}

export default function ProductionBoard() {
  const state = useLoopStore((s) => s.state);
  const store = useLoopStore();
  const { game, run, lastNotices: notices } = state;

  if (!game || !run) return null;

  const demand = MILESTONE_TUNING.SCOPE_DEMAND_PER_WORKSTREAM[run.scopeTier];
  const complete = isProductionComplete(run);
  const preview = complete
    ? produceAxes(
        toProductionInputs(run, {
          riskTaking: state.riskTaking,
          engineTechLevel: projectEngine(state).techLevel,
        }),
        blendGenreProfiles(game.genres),
      )
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">
            Production
          </p>
          <h1 className="text-3xl font-bold">{game.title}</h1>
        </div>
        <span className="text-sm text-zinc-400">
          Milestone {Math.min(run.milestoneIndex, run.totalMilestones)}/{run.totalMilestones}
        </span>
      </header>

      {/* Event interrupt */}
      {run.pendingEvent && (
        <section className="space-y-3 rounded-xl border border-amber-400/60 bg-amber-400/5 p-4">
          <p className="font-medium text-amber-300">{run.pendingEvent.text}</p>
          <div className="flex flex-wrap gap-2">
            {run.pendingEvent.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => store.resolveEvent(option.id)}
                className="rounded-md border border-amber-400/60 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-400/10"
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Workstream board */}
      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Workstreams — effort allocation & progress
        </h2>
        {WORKSTREAMS.map((ws) => (
          <div key={ws} className="grid grid-cols-[6rem_1fr_1fr] items-center gap-3">
            <span className="text-sm capitalize text-zinc-300">{ws}</span>
            <input
              type="range"
              min={0}
              max={40}
              value={run.allocation[ws]}
              disabled={complete}
              onChange={(e) => store.setAllocation(ws, Number(e.target.value))}
              className="accent-amber-400"
            />
            <div className="h-2 rounded bg-zinc-800">
              <div
                className="h-2 rounded bg-amber-400/80"
                style={{ width: `${Math.min(100, (run.progress[ws] / demand) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      {/* Team */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Team{" "}
          {run.departedStaff.length > 0 && (
            <span className="normal-case text-red-400">
              — departed: {run.departedStaff.join(", ")}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {run.staff.map((member) => (
            <StaffCard key={member.id} member={member} />
          ))}
        </div>
      </section>

      {/* Controls */}
      {!complete && (
        <footer className="flex items-center gap-3">
          <button
            type="button"
            disabled={run.pendingEvent !== null}
            onClick={store.advanceProduction}
            className="rounded-md bg-amber-400 px-5 py-2 font-semibold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Advance milestone
          </button>
          <button
            type="button"
            onClick={() => store.setCrunch(!run.crunching)}
            className={`rounded-md border px-4 py-2 text-sm ${
              run.crunching
                ? "border-red-500 bg-red-500/10 text-red-300"
                : "border-zinc-600 text-zinc-300 hover:border-zinc-400"
            }`}
          >
            {run.crunching ? "Crunching — team is paying for it" : "Crunch: off"}
          </button>
        </footer>
      )}

      {/* Notices */}
      {notices.length > 0 && (
        <ul className="space-y-1 text-sm text-zinc-400">
          {notices.map((n, i) => (
            <li key={i} className={n.kind === "quit" ? "text-red-400" : ""}>
              {n.text}
            </li>
          ))}
        </ul>
      )}

      {/* Content-complete: axis preview */}
      {preview && (
        <section className="space-y-3 rounded-xl border border-emerald-500/40 bg-zinc-900 p-4">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-400">
            Content-complete
          </p>
          <div className="space-y-1">
            {QUALITY_AXES.map((axis) => (
              <Meter key={axis} label={axis} value={preview.axes[axis]} tone="bg-emerald-400" />
            ))}
          </div>
          <p className="text-sm text-zinc-300">
            Objective quality{" "}
            <span className="font-bold text-emerald-300">{Math.round(preview.q)}</span>
            <span className="ml-2 text-zinc-500">— time to decide how this ships</span>
          </p>
          <button
            type="button"
            onClick={store.enterShipDecision}
            className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300"
          >
            Go to the Ship Decision
          </button>
        </section>
      )}
    </div>
  );
}
