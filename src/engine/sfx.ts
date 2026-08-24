/**
 * Sound. Loud, over-produced, constantly present — and gated behind a real
 * user gesture, because browsers require it and because a game that screams
 * before you press anything is a game people close.
 */

export interface SfxHandle {
  unlock(): void;
  setMuted(muted: boolean): void;
  muted: boolean;
  click(): void;
  pick(step: number): void;
  solve(): void;
  fail(): void;
  skip(): void;
  thud(): void;
  blip(): void;
}

type Osc = OscillatorType;

export function createSfx(): SfxHandle {
  let ctx: AudioContext | null = null;
  let muted = false;

  const ac = (): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };

  const tone = (freq: number, dur: number, type: Osc, vol: number, delay = 0) => {
    if (muted) return;
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  };

  const handle: SfxHandle = {
    unlock: () => void ac(),
    setMuted: (m) => {
      muted = m;
      handle.muted = m;
    },
    muted: false,
    click: () => tone(320, 0.05, "square", 0.05),
    pick: (step) => tone(440 + step * 70, 0.09, "square", 0.06),
    solve: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "square", 0.07, i * 0.07)),
    fail: () => [330, 262, 196, 147].forEach((f, i) => tone(f, 0.2, "sawtooth", 0.06, i * 0.08)),
    skip: () => tone(180, 0.22, "sawtooth", 0.05),
    thud: () => tone(90, 0.12, "sine", 0.09),
    blip: () => tone(880, 0.03, "square", 0.03),
  };
  return handle;
}

/** For tests and headless runs: records calls, makes no noise. */
export function createSilentSfx(): SfxHandle & { calls: string[] } {
  const calls: string[] = [];
  const noop = (name: string) => () => void calls.push(name);
  return {
    calls,
    muted: true,
    unlock: noop("unlock"),
    setMuted: noop("setMuted"),
    click: noop("click"),
    pick: noop("pick"),
    solve: noop("solve"),
    fail: noop("fail"),
    skip: noop("skip"),
    thud: noop("thud"),
    blip: noop("blip"),
  };
}
