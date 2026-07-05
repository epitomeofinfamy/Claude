/**
 * Tiny WebAudio cues for the reveal (§14: "deliberate pacing and sound").
 * Synthesized on the fly — no assets, no autoplay (first call follows the
 * launch click, so the AudioContext is user-gesture-unlocked).
 */

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

function audio(): AudioContext | null {
  if (muted || typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, at: number, duration = 0.14, peak = 0.12): void {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const t0 = a.currentTime + at;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** One review lands: a single blip, pitched by how kind it was. */
export function playReviewCue(score: number): void {
  blip(280 + score * 5, 0);
}

/** The user score: two quick voices — the crowd weighing in. */
export function playUserScoreCue(score: number): void {
  blip(240 + score * 4, 0, 0.12);
  blip(320 + score * 4, 0.1, 0.16);
}

/** The Metascore: a three-note chord — triumphant when it's earned. */
export function playMetascoreCue(score: number): void {
  const base = 220 + score * 3;
  const intervals = score >= 75 ? [1, 1.25, 1.5] : score >= 60 ? [1, 1.2, 1.5] : [1, 1.19, 1.41];
  intervals.forEach((ratio, i) => blip(base * ratio, i * 0.12, 0.5, 0.1));
}
