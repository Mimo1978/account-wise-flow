/**
 * Jarvis universal "ready" chime.
 *
 * A clear, pleasant two-note bell played at the moment Jarvis hands the
 * conversation back to the user. Replaces the previous double-chime
 * (turn-end + listening-ping) which felt noisy and echoed.
 *
 * Design:
 *   • Two-note ascending bell (C5 → G5) — bright, friendly, noticeable.
 *   • Sine fundamental + soft 2nd-harmonic shimmer for "bell" character.
 *   • Gentle attack, longer exponential decay (~0.9s) — pleasant, not abrupt.
 *   • 800ms debounce so back-to-back triggers from different code paths
 *     (TTS-end + mic-start) collapse into a single audible cue.
 */

let lastPlayedAt = 0;
const DEBOUNCE_MS = 800;

function ringNote(
  ctx: AudioContext,
  destination: AudioNode,
  freq: number,
  startAt: number,
  duration: number,
  peak: number
) {
  // Fundamental sine
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startAt);
  env.gain.setValueAtTime(0.0001, startAt);
  env.gain.exponentialRampToValueAtTime(peak, startAt + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0005, startAt + duration);
  osc.connect(env);
  env.connect(destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);

  // Soft 2nd-harmonic shimmer for bell character
  const shimmer = ctx.createOscillator();
  const shimEnv = ctx.createGain();
  shimmer.type = "sine";
  shimmer.frequency.setValueAtTime(freq * 2, startAt);
  shimEnv.gain.setValueAtTime(0.0001, startAt);
  shimEnv.gain.exponentialRampToValueAtTime(peak * 0.35, startAt + 0.008);
  shimEnv.gain.exponentialRampToValueAtTime(0.0005, startAt + duration * 0.55);
  shimmer.connect(shimEnv);
  shimEnv.connect(destination);
  shimmer.start(startAt);
  shimmer.stop(startAt + duration);
}

function playReadyChime() {
  const now = Date.now();
  if (now - lastPlayedAt < DEBOUNCE_MS) return;
  lastPlayedAt = now;

  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.55, ctx.currentTime);
    master.connect(ctx.destination);

    const t0 = ctx.currentTime;
    // Two-note ascending bell: C5 → G5 (bright, friendly, "your turn")
    ringNote(ctx, master, 523.25, t0, 0.85, 0.7);
    ringNote(ctx, master, 783.99, t0 + 0.13, 0.95, 0.7);

    setTimeout(() => { try { ctx.close(); } catch { /* noop */ } }, 1400);
  } catch {
    // AudioContext unavailable — silently ignore.
  }
}

/**
 * Jarvis has finished speaking — your turn.
 * Universal cue across all Jarvis surfaces (chat, wizard, workflows).
 */
export function playYourTurnChime() {
  playReadyChime();
}

/**
 * Microphone is now listening. Aliased to the same chime + debounced so it
 * never doubles-up with the "your turn" cue when both fire in sequence.
 */
export function playListeningPing() {
  playReadyChime();
}

/**
 * Soft "got it / processing" cue — fires when the silence timer auto-submits
 * the user's spoken answer. Distinct from the bright two-note "your turn"
 * bell: a single short low-to-mid blip so the user knows Jarvis has accepted
 * the input and is processing, even though the mic just cut out.
 */
let lastProcessingAt = 0;
const PROCESSING_DEBOUNCE_MS = 600;
export function playProcessingChime() {
  const now = Date.now();
  if (now - lastProcessingAt < PROCESSING_DEBOUNCE_MS) return;
  lastProcessingAt = now;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.5, ctx.currentTime);
    master.connect(ctx.destination);
    const t0 = ctx.currentTime;
    // Short descending two-note blip: G5 → E5, quick decay (~0.35s total)
    ringNote(ctx, master, 783.99, t0, 0.22, 0.55);
    ringNote(ctx, master, 659.25, t0 + 0.09, 0.28, 0.55);
    setTimeout(() => { try { ctx.close(); } catch { /* noop */ } }, 600);
  } catch {
    // ignore
  }
}
