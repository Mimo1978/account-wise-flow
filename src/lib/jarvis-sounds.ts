/**
 * Jarvis universal "ready" chime.
 *
 * One short, warm, single-event tone played at the moment Jarvis hands the
 * conversation back to the user — i.e. she has stopped speaking and the
 * microphone is now listening. Replaces the previous double-chime
 * (turn-end + listening-ping) which felt noisy and echoed.
 *
 * Design:
 *   • One soft sine tone, ~180ms, no harmonic stack, no shimmer.
 *   • Gentle attack and exponential decay — pleasant, not abrupt.
 *   • Built-in 800ms debounce so back-to-back triggers from different code
 *     paths (TTS-end + mic-start) collapse into a single audible cue.
 */

let lastPlayedAt = 0;
const DEBOUNCE_MS = 800;

function playReadyChime() {
  const now = Date.now();
  if (now - lastPlayedAt < DEBOUNCE_MS) return;
  lastPlayedAt = now;

  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + 0.32);
    master.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    // Soft E5 → G5 — a small uplifting interval that signals "your turn".
    osc.frequency.setValueAtTime(659.25, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(783.99, ctx.currentTime + 0.18);
    osc.connect(master);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.34);

    setTimeout(() => { try { ctx.close(); } catch { /* noop */ } }, 600);
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
