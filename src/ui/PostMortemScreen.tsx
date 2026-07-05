import { AXIS_LABELS } from "../game/postmortem";
import { useLoopStore } from "../state/loopStore";
import { scoreTone } from "./components";

export default function PostMortemScreen() {
  const state = useLoopStore((s) => s.state);
  const store = useLoopStore();
  const { game, launch: result } = state;

  if (!game || !result) return null;
  const { reception, userScore, postMortem } = result;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">Post-mortem</p>
        <h1 className="text-3xl font-bold">{game.title}</h1>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Metascore</p>
          <p className={`text-4xl font-black ${scoreTone(reception.metascore)}`}>
            {Math.round(reception.metascore)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">User score</p>
          <p className={`text-4xl font-black ${scoreTone(userScore)}`}>{Math.round(userScore)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Objective quality</p>
          <p className="text-4xl font-black text-zinc-300">{Math.round(result.q)}</p>
          <p className="text-xs text-zinc-500">what it deserved (Q)</p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-sm font-medium text-amber-200">{postMortem.summary.text}</p>

        <div>
          {postMortem.pullQuotes.map((quote) => (
            <p key={quote} className="text-sm italic text-zinc-400">
              “{quote}”
            </p>
          ))}
        </div>

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
        onClick={store.completePostMortem}
        className="rounded-md bg-amber-400 px-5 py-2 font-semibold text-zinc-950 hover:bg-amber-300"
      >
        Close the books
      </button>
    </div>
  );
}
