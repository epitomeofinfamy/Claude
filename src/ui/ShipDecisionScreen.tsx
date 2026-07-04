import { QUALITY_AXES, PLATFORMS, type ReleaseWindow } from "../game/types";
import { MILESTONE_TUNING } from "../game/milestones";
import { deriveWindowCrowding, estimateReception } from "../game/shipdecision";
import { blendGenreProfiles } from "../game/conception";
import { PLATFORM_CATALOG } from "../game/data/platforms";
import { STUB_MARKET } from "../game/data/market";
import { OUTLETS } from "../game/data/outlets";
import { useShipStore } from "../state/shipStore";
import { useStudioStore } from "../state/studioStore";

function Meter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 capitalize text-zinc-500">{label}</span>
      <div className="h-1.5 flex-1 rounded bg-zinc-800">
        <div className={`h-1.5 rounded ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="w-8 text-right text-zinc-400">{Math.round(value)}</span>
    </div>
  );
}

/** The next six quarters starting after the last production milestone. */
function upcomingWindows(): ReleaseWindow[] {
  const windows: ReleaseWindow[] = [];
  let year = 1985;
  let quarter = 4;
  for (let i = 0; i < 6; i++) {
    windows.push({ year, quarter: quarter as ReleaseWindow["quarter"] });
    quarter++;
    if (quarter > 4) {
      quarter = 1;
      year++;
    }
  }
  return windows;
}

const CROWDING_STYLE: Record<string, string> = {
  crowded: "text-red-400",
  normal: "text-zinc-400",
  clear: "text-emerald-400",
};

export default function ShipDecisionScreen() {
  const game = useShipStore((s) => s.game);
  const ship = useShipStore((s) => s.ship);
  const plan = useShipStore((s) => s.plan);
  const store = useShipStore();
  const studio = useStudioStore();

  if (!game || !ship) return null;

  const estimate = estimateReception(ship, plan, {
    game,
    genreProfile: blendGenreProfiles(game.genres),
    market: STUB_MARKET,
    outlets: OUTLETS,
    engineTechLevel: studio.engines[0]?.techLevel ?? 20,
    riskTaking: 50,
    reputation: studio.reputation,
    sequelPedigree: 0,
  });
  const avgBurnout =
    ship.run.staff.length > 0
      ? ship.run.staff.reduce((s, m) => s + m.burnout, 0) / ship.run.staff.length
      : 0;
  const effectiveHype = Math.max(0, plan.marketingHype - ship.hypeCooled);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">
            The Ship Decision
          </p>
          <h1 className="text-3xl font-bold">{game.title}</h1>
        </div>
        <div className="text-right text-sm text-zinc-400">
          {ship.delayedMilestones > 0 && <p>Slipped {ship.delayedMilestones} milestone(s)</p>}
          {ship.extraBudget > 0 && <p>Extra spend ${ship.extraBudget.toLocaleString()}</p>}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Current axis readings + estimates */}
        <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Axis readings (if shipped now)
          </h2>
          {QUALITY_AXES.map((axis) => (
            <Meter key={axis} label={axis} value={estimate.axes[axis]} tone="bg-amber-400" />
          ))}
          <p className="pt-1 text-sm text-zinc-300">
            Estimated reception:{" "}
            <span className="font-semibold text-amber-300">critics ~{Math.round(estimate.metascore)}</span>
            {" · "}
            <span className="font-semibold text-sky-300">users ~{Math.round(estimate.userScore)}</span>
          </p>
        </section>

        {/* Bugs + team */}
        <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            The cost of shipping now
          </h2>
          <Meter
            label="Open bugs"
            value={ship.remainingBugs}
            tone={ship.remainingBugs > 40 ? "bg-red-500" : "bg-orange-400"}
          />
          <Meter
            label="Team burnout"
            value={avgBurnout}
            tone={avgBurnout >= MILESTONE_TUNING.BURNOUT_THRESHOLD ? "bg-red-500" : "bg-orange-400"}
          />
          <p className="text-xs text-zinc-500">
            Bugs ship as launch-day polish damage; a torched team quits or underperforms next
            project.
          </p>
          {ship.run.departedStaff.length > 0 && (
            <p className="text-xs text-red-400">Departed: {ship.run.departedStaff.join(", ")}</p>
          )}
        </section>
      </div>

      {/* The four levers */}
      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Levers — combine as needed
        </h2>
        <div className="grid gap-2 sm:grid-cols-4">
          <button type="button" onClick={store.polish} className="rounded-md border border-zinc-700 p-3 text-left hover:border-amber-400">
            <p className="font-semibold text-amber-300">Polish</p>
            <p className="text-xs text-zinc-500">Bugs ↓ Polish ↑ · slips a milestone, costs budget</p>
          </button>
          <button type="button" onClick={store.crunch} className="rounded-md border border-zinc-700 p-3 text-left hover:border-red-400">
            <p className="font-semibold text-red-300">Crunch</p>
            <p className="text-xs text-zinc-500">Same work, no slip · burnout ↑, quit risk</p>
          </button>
          <button type="button" onClick={store.cutScope} className="rounded-md border border-zinc-700 p-3 text-left hover:border-sky-400">
            <p className="font-semibold text-sky-300">Cut scope</p>
            <p className="text-xs text-zinc-500">Ships on time, bugs ↓ · Content pays</p>
          </button>
          <button type="button" onClick={store.delay} className="rounded-md border border-zinc-700 p-3 text-left hover:border-emerald-400">
            <p className="font-semibold text-emerald-300">Delay</p>
            <p className="text-xs text-zinc-500">Team rests · budget ↑, hype cools</p>
          </button>
        </div>
      </section>

      {/* Launch plan */}
      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Launch</h2>

        <div className="space-y-1">
          <p className="text-xs text-zinc-500">Release window — the competitive calendar</p>
          <div className="flex flex-wrap gap-2">
            {upcomingWindows().map((w) => {
              const crowding = deriveWindowCrowding(STUB_MARKET, w);
              const selected =
                plan.releaseWindow.year === w.year && plan.releaseWindow.quarter === w.quarter;
              const rivals = STUB_MARKET.competitorCalendar.filter(
                (c) => c.releaseWindow.year === w.year && c.releaseWindow.quarter === w.quarter,
              );
              return (
                <button
                  key={`${w.year}-${w.quarter}`}
                  type="button"
                  onClick={() => store.setPlan({ releaseWindow: w })}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    selected ? "border-amber-400 bg-amber-400/10" : "border-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  <p>
                    Q{w.quarter} {w.year}
                  </p>
                  <p className={`text-xs ${CROWDING_STYLE[crowding]}`}>
                    {crowding}
                    {rivals.length > 0 && ` — ${rivals.map((r) => r.title).join(", ")}`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-zinc-400">
              Marketing spend: {plan.marketingHype}
              {ship.hypeCooled > 0 && (
                <span className="text-zinc-500"> (effective {effectiveHype} after cooling)</span>
              )}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={plan.marketingHype}
              onChange={(e) => store.setPlan({ marketingHype: Number(e.target.value) })}
              className="w-full accent-amber-400"
            />
            <span className="text-xs text-zinc-600">
              Sets expectations — a loan against your quality (§7.6).
            </span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-400">Price positioning: {plan.price}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={plan.price}
              onChange={(e) => store.setPlan({ price: Number(e.target.value) })}
              className="w-full accent-amber-400"
            />
            <span className="text-xs text-zinc-600">50 = standard; users weigh value hard.</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((platform) => {
            const selected = plan.platforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                onClick={() =>
                  store.setPlan({
                    platforms: selected
                      ? plan.platforms.filter((p) => p !== platform)
                      : [...plan.platforms, platform],
                  })
                }
                className={`rounded-full border px-3 py-1 text-sm ${
                  selected
                    ? "border-amber-400 bg-amber-400/15 text-amber-300"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {PLATFORM_CATALOG[platform].name}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={plan.platforms.length === 0}
          onClick={store.launch}
          className="rounded-md bg-amber-400 px-6 py-2.5 text-lg font-bold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Go gold — launch
        </button>
      </section>
    </div>
  );
}
