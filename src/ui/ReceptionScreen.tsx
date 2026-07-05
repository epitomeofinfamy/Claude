import { useEffect, useState } from "react";
import { isRevealComplete } from "../game/loop";
import { useLoopStore } from "../state/loopStore";
import { Panel, PrimaryButton, GhostButton, scoreTone } from "./components";
import {
  isMuted,
  playMetascoreCue,
  playReviewCue,
  playUserScoreCue,
  setMuted,
} from "./sound";

/** Pacing for the roll-in (§14: deliberate pacing and sound). */
const FIRST_REVIEW_DELAY = 2_200;
const REVIEW_DELAY = 1_500;
const USER_SCORE_DELAY = 2_000;
const METASCORE_DELAY = 2_400;

export default function ReceptionScreen() {
  const state = useLoopStore((s) => s.state);
  const store = useLoopStore();
  const { game, launch: result, reveal } = state;
  const [skipped, setSkipped] = useState(false);
  const [muted, setMutedUi] = useState(isMuted());

  const complete = reveal !== null && isRevealComplete(reveal);

  // The roll-in: the store owns the reveal state; this effect only paces it.
  useEffect(() => {
    if (!reveal || !result || skipped || complete) return;
    const nextIsReview = reveal.reviewsRevealed < reveal.totalReviews;
    const nextIsUser = !nextIsReview && !reveal.userScoreRevealed;
    const delay = nextIsReview
      ? reveal.reviewsRevealed === 0
        ? FIRST_REVIEW_DELAY
        : REVIEW_DELAY
      : nextIsUser
        ? USER_SCORE_DELAY
        : METASCORE_DELAY;
    const timer = setTimeout(() => {
      if (nextIsReview) {
        playReviewCue(result.reception.reviews[reveal.reviewsRevealed]!.score);
      } else if (nextIsUser) {
        playUserScoreCue(result.userScore);
      } else {
        playMetascoreCue(result.reception.metascore);
      }
      store.advanceReveal();
    }, delay);
    return () => clearTimeout(timer);
  }, [reveal, result, skipped, complete, store]);

  if (!game || !result || !reveal) return null;
  const { reception, userScore } = result;

  const stageLine = complete
    ? "The dust settles."
    : reveal.reviewsRevealed === 0
      ? "Launch week. The press has the build…"
      : reveal.reviewsRevealed < reveal.totalReviews
        ? "Reviews are rolling in…"
        : !reveal.userScoreRevealed
          ? "The players are talking…"
          : "The aggregate is coming up…";

  const skipAll = () => {
    setSkipped(true);
    let guard = 0;
    while (!isRevealComplete(useLoopStore.getState().state.reveal!) && guard++ < 20) {
      useLoopStore.getState().advanceReveal();
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="text-center">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-amber-400">Reception</p>
        <h1 className="text-3xl font-bold">{game.title}</h1>
        <p className={`text-sm text-zinc-500 ${complete ? "" : "animate-waiting"}`}>{stageLine}</p>
      </header>

      {/* The press, one verdict at a time */}
      <Panel title="The press">
        {reception.reviews.map((review, i) => {
          const revealed = i < reveal.reviewsRevealed;
          return revealed ? (
            <div key={review.outletId} className="animate-reveal flex justify-between text-sm">
              <span className="text-zinc-300">{review.outletName}</span>
              <span className={`font-bold tabular-nums ${scoreTone(review.score)}`}>
                {Math.round(review.score)}
              </span>
            </div>
          ) : (
            <div key={review.outletId} className="flex justify-between text-sm">
              <span className="text-zinc-600">{review.outletName}</span>
              <span className="animate-waiting text-zinc-600">•••</span>
            </div>
          );
        })}
      </Panel>

      {/* Then the users */}
      {reveal.userScoreRevealed && (
        <div className="animate-reveal rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">User score</p>
          <p className={`text-4xl font-black tabular-nums ${scoreTone(userScore)}`}>
            {Math.round(userScore)}
          </p>
          <p className="text-xs text-zinc-500">the players have opinions</p>
        </div>
      )}

      {/* Then the number the whole economy keys off */}
      {reveal.metascoreRevealed && (
        <div className="animate-meta rounded-2xl border-2 border-amber-400/70 bg-gradient-to-b from-amber-400/10 to-transparent p-8 text-center shadow-[0_0_60px_-20px_rgba(251,191,36,0.45)]">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400">Metascore</p>
          <p className={`text-7xl font-black tabular-nums ${scoreTone(reception.metascore)}`}>
            {Math.round(reception.metascore)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            consensus{" "}
            {reception.consensus >= 0.7 ? "tight" : reception.consensus >= 0.4 ? "mixed" : "divisive"}
          </p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        {complete ? (
          <PrimaryButton onClick={store.finishReveal} className="animate-reveal">
            Read the post-mortem
          </PrimaryButton>
        ) : (
          <GhostButton onClick={skipAll}>Skip to the verdict</GhostButton>
        )}
        <GhostButton
          onClick={() => {
            setMuted(!muted);
            setMutedUi(!muted);
          }}
        >
          {muted ? "🔇 sound off" : "🔊 sound on"}
        </GhostButton>
      </div>
    </div>
  );
}
