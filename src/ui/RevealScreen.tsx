import { AXIS_LABELS } from "../game/postmortem";
import { useShipStore } from "../state/shipStore";
import { useConceptionStore } from "../state/conceptionStore";

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-300";
  if (score >= 65) return "text-amber-300";
  return "text-red-300";
}

export default function RevealScreen() {
  const game = useShipStore((s) => s.game);
  const result = useShipStore((s) => s.result);
  const reset = useShipStore((s) => s.reset);
  const startOver = useConceptionStore((s) => s.startOver);

  if (!game || !result) return null;
  const { reception, userScore, postMortem } = result;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">Reception</p>
        <h1 className="text-3xl font-bold">{game.title}</h1>
      </header>

      {/* The scores */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Metascore</p>
          <p className={`text-5xl font-black ${scoreTone(reception.metascore)}`}>
            {Math.round(reception.metascore)}
          </p>
          <p className="text-xs text-zinc-500">
            consensus {reception.consensus >= 0.7 ? "tight" : reception.consensus >= 0.4 ? "mixed" : "divisive"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">User score</p>
          <p className={`text-5xl font-black ${scoreTone(userScore)}`}>{Math.round(userScore)}</p>
          <p className="text-xs text-zinc-500">at launch</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Objective quality</p>
          <p className="text-5xl font-black text-zinc-300">{Math.round(result.q)}</p>
          <p className="text-xs text-zinc-500">what it deserved (Q)</p>
        </div>
      </section>

      {/* Outlet reviews */}
      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">The press</h2>
        {reception.reviews.map((review) => (
          <div key={review.outletId} className="flex justify-between text-sm">
            <span className="text-zinc-300">{review.outletName}</span>
            <span className={`font-bold ${scoreTone(review.score)}`}>{Math.round(review.score)}</span>
          </div>
        ))}
        <div className="pt-2">
          {postMortem.pullQuotes.map((quote) => (
            <p key={quote} className="text-sm italic text-zinc-400">
              “{quote}”
            </p>
          ))}
        </div>
      </section>

      {/* Post-mortem */}
      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Post-mortem</h2>
        <p className="text-sm font-medium text-amber-200">{postMortem.summary.text}</p>

        <div className="space-y-1">
          {postMortem.axisBreakdown.map((entry) => (
            <div key={entry.axis} className="flex items-center gap-2 text-xs">
              <span className="w-24 text-zinc-400">{AXIS_LABELS[entry.axis]}</span>
              <span className="w-8 text-right text-zinc-300">{Math.round(entry.score)}</span>
              <span
                className={
                  entry.verdict === "over-performed"
                    ? "text-emerald-400"
                    : entry.verdict === "under-performed"
                      ? "text-red-400"
                      : "text-zinc-500"
                }
              >
                {entry.verdict}
              </span>
              {entry.emphasis === "emphasized" && (
                <span className="text-zinc-600">(genre-critical)</span>
              )}
            </div>
          ))}
        </div>

        {postMortem.diagnoses.length > 0 && (
          <ul className="space-y-1 text-sm text-zinc-400">
            {postMortem.diagnoses.map((d) => (
              <li key={d.id}>• {d.text}</li>
            ))}
          </ul>
        )}

        {postMortem.userComplaints.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Top user complaints</p>
            {postMortem.userComplaints.map((c) => (
              <p key={c.id} className="text-sm text-zinc-400">
                {c.text}
              </p>
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => {
          reset();
          startOver();
        }}
        className="rounded-md bg-amber-400 px-5 py-2 font-semibold text-zinc-950 hover:bg-amber-300"
      >
        Start the next project
      </button>
    </div>
  );
}
