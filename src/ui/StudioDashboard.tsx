import { GENRES, TOPICS, type TrendPhase } from "../game/types";
import { MARKET_TUNING, toMarketView, upcomingWindows } from "../game/market";
import { deriveWindowCrowding } from "../game/shipdecision";
import { maxStaff } from "../game/progression";
import { useLoopStore } from "../state/loopStore";
import { Panel, StatTile } from "./components";

const PHASE_BADGE: Record<TrendPhase, { text: string; tone: string }> = {
  rising: { text: "▲ rising", tone: "text-emerald-300" },
  neutral: { text: "→ steady", tone: "text-zinc-500" },
  fatigued: { text: "▼ fatigued", tone: "text-red-300" },
};

const CROWDING_TONE: Record<string, string> = {
  crowded: "text-red-300",
  normal: "text-zinc-500",
  clear: "text-emerald-300",
};

/** The §14 home base: cash, reputation, market trends, and the calendar. */
export default function StudioDashboard() {
  const state = useLoopStore((s) => s.state);
  const { studio, market, pendingRevenue } = state;
  const view = toMarketView(market);
  const backCatalog = pendingRevenue.reduce((s, v) => s + v, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="Cash"
          value={`$${studio.cash.toLocaleString()}`}
          sub={backCatalog > 0 ? `+$${backCatalog.toLocaleString()} tailing in` : undefined}
          tone={studio.cash < 15_000 ? "text-red-300" : "text-emerald-300"}
        />
        <StatTile
          label="Reputation"
          value={`${Math.round(studio.reputation)}`}
          sub="raises doors and bars alike"
          tone="text-amber-300"
        />
        <StatTile
          label="Office"
          value={studio.offices}
          sub={`${studio.staff.length}/${maxStaff(studio.offices)} desks`}
        />
        <StatTile label="Date" value={`Q${market.quarter} ${market.year}`} sub={studio.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Market trends" hint="ride the wave, dodge the flood">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="space-y-1">
              {GENRES.map((genre) => {
                const badge = PHASE_BADGE[view.genreTrend[genre]];
                const flooded = view.saturation[genre] >= MARKET_TUNING.SATURATION_FATIGUE_BAR;
                return (
                  <div key={genre} className="flex justify-between gap-2">
                    <span className="capitalize text-zinc-300">{genre}</span>
                    <span className={badge.tone}>
                      {badge.text}
                      {flooded && " · flooded"}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="space-y-1">
              {TOPICS.map((topic) => {
                const badge = PHASE_BADGE[view.topicTrend[topic]];
                return (
                  <div key={topic} className="flex justify-between gap-2">
                    <span className="capitalize text-zinc-300">{topic}</span>
                    <span className={badge.tone}>{badge.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        <Panel title="The calendar" hint="who ships when">
          <div className="space-y-1 text-sm">
            {upcomingWindows(market, 4).map((w) => {
              const crowding = deriveWindowCrowding(view, w);
              const rivals = view.competitorCalendar.filter(
                (c) => c.releaseWindow.year === w.year && c.releaseWindow.quarter === w.quarter,
              );
              return (
                <div key={`${w.year}q${w.quarter}`} className="flex justify-between gap-2">
                  <span className="text-zinc-300">
                    Q{w.quarter} {w.year}
                  </span>
                  <span className={CROWDING_TONE[crowding]}>
                    {rivals.length > 0
                      ? rivals.map((r) => `${r.title} (${r.studioName})`).join(", ")
                      : crowding}
                  </span>
                </div>
              );
            })}
          </div>
          {studio.ipCatalog.length > 0 && (
            <div className="border-t border-zinc-800 pt-2 text-sm">
              <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Franchises</p>
              {studio.ipCatalog.map((ip) => (
                <div key={ip.id} className="flex justify-between">
                  <span className="text-zinc-300">{ip.name}</span>
                  <span className="text-zinc-500">
                    pedigree {ip.pedigree} · {ip.entries.length} game
                    {ip.entries.length === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
