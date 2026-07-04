import { isRevealComplete } from "../game/loop";
import { useLoopStore } from "../state/loopStore";

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-300";
  if (score >= 65) return "text-amber-300";
  return "text-red-300";
}

export default function ReceptionScreen() {
  const state = useLoopStore((s) => s.state);
  const store = useLoopStore();
  const { game, launch: result, reveal } = state;

  if (!game || !result || !reveal) return null;
  const { reception, userScore } = result;
  const complete = isRevealComplete(reveal);

  const nextLabel =
    reveal.reviewsRevealed < reveal.totalReviews
      ? reveal.reviewsRevealed === 0
        ? "The first review is in…"
        : "Another review is in…"
      : !reveal.userScoreRevealed
        ? "User reviews are rolling in…"
        : "The aggregate is up…";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="text-center">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">Reception</p>
        <h1 className="text-3xl font-bold">{game.title}</h1>
        <p className="text-sm text-zinc-500">Launch week. The press has the build.</p>
      </header>

      {/* Reviews roll in one at a time */}
      <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">The press</h2>
        {reception.reviews.map((review, i) => {
          const revealed = i < reveal.reviewsRevealed;
          return (
            <div key={review.outletId} className="flex justify-between text-sm">
              <span className={revealed ? "text-zinc-300" : "text-zinc-600"}>
                {review.outletName}
              </span>
              {revealed ? (
                <span className={`font-bold ${scoreTone(review.score)}`}>
                  {Math.round(review.score)}
                </span>
              ) : (
                <span className="text-zinc-700">—</span>
              )}
            </div>
          );
        })}
      </section>

      {/* Then the user score */}
      {reveal.userScoreRevealed && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">User score</p>
          <p className={`text-4xl font-black ${scoreTone(userScore)}`}>{Math.round(userScore)}</p>
          <p className="text-xs text-zinc-500">the players have opinions</p>
        </section>
      )}

      {/* Then the Metascore — the number the whole economy keys off */}
      {reveal.metascoreRevealed && (
        <section className="rounded-xl border border-amber-400/60 bg-amber-400/5 p-6 text-center">
          <p className="text-xs uppercase tracking-wider text-amber-400">Metascore</p>
          <p className={`text-6xl font-black ${scoreTone(reception.metascore)}`}>
            {Math.round(reception.metascore)}
          </p>
          <p className="text-xs text-zinc-500">
            consensus{" "}
            {reception.consensus >= 0.7 ? "tight" : reception.consensus >= 0.4 ? "mixed" : "divisive"}
          </p>
        </section>
      )}

      <div className="text-center">
        {complete ? (
          <button
            type="button"
            onClick={store.finishReveal}
            className="rounded-md bg-amber-400 px-5 py-2 font-semibold text-zinc-950 hover:bg-amber-300"
          >
            Read the post-mortem
          </button>
        ) : (
          <button
            type="button"
            onClick={store.advanceReveal}
            className="rounded-md border border-amber-400/60 px-5 py-2 font-semibold text-amber-300 hover:bg-amber-400/10"
          >
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
