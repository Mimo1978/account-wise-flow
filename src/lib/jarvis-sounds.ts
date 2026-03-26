export function playYourTurnChime() {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.18, ctx.currentTime);
    master.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    const env1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(784, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.6);
    env1.gain.setValueAtTime(0, ctx.currentTime);
    env1.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.01);
    env1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc1.connect(env1);
    env1.connect(master);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 1.2);

    const osc2 = ctx.createOscillator();
    const env2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659, ctx.currentTime + 0.18);
    osc2.frequency.exponentialRampToValueAtTime(610, ctx.currentTime + 0.8);
    env2.gain.setValueAtTime(0, ctx.currentTime + 0.18);
    env2.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 0.22);
    env2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
    osc2.connect(env2);
    env2.connect(master);
    osc2.start(ctx.currentTime + 0.18);
    osc2.stop(ctx.currentTime + 1.4);

    const shimmer = ctx.createOscillator();
    const shimEnv = ctx.createGain();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(1568, ctx.currentTime);
    shimEnv.gain.setValueAtTime(0, ctx.currentTime);
    shimEnv.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.01);
    shimEnv.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    shimmer.connect(shimEnv);
    shimEnv.connect(master);
    shimmer.start(ctx.currentTime);
    shimmer.stop(ctx.currentTime + 0.5);

    setTimeout(() => ctx.close(), 2000);
  } catch (e) {
    // Silently ignore if AudioContext not available
  }
}

export function playListeningPing() {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.12, ctx.currentTime);
    master.connect(ctx.destination);

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(659, ctx.currentTime + 0.12);
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(env);
    env.connect(master);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);

    setTimeout(() => ctx.close(), 800);
  } catch (e) {
    // Silently ignore
  }
}
