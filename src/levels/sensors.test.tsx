import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BY_ID } from "./registry";
import { CATALOG } from "./catalog";
import { streamFor } from "@/engine/rng";
import { createSilentSfx } from "@/engine/sfx";
import type { Adapter, AudioSample, CameraSample, MotionSample } from "@/input/adapters/types";
import type { LevelModule, LevelProps } from "@/engine/types";
import { freshTray, SETTLE_DEG, slotX, step } from "./L13ConfirmWithAGesture/tray";
import { beatMs, matches, type Beat } from "./L26EmergencyVerification";

afterEach(cleanup);

/** A hand-driven adapter, so a test can shake a phone or scream into a mic. */
function fakeAdapter<T>(initial: T): Adapter<T> & { push(v: T): void } {
  const subs = new Set<(v: T) => void>();
  let last = initial;
  return {
    subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
    current: () => last,
    destroy: () => subs.clear(),
    push(v) {
      last = v;
      for (const cb of subs) cb(v);
    },
  };
}

interface Rig {
  motion: ReturnType<typeof fakeAdapter<MotionSample>>;
  audioIn: ReturnType<typeof fakeAdapter<AudioSample>>;
  camera: ReturnType<typeof fakeAdapter<CameraSample>>;
  haptics: { available: boolean; patterns: number[][] };
}

function mount(id: string, opts: { fallback?: boolean; haptics?: boolean; seed?: number } = {}) {
  const mod = BY_ID.get(id) as LevelModule;
  const rig: Rig = {
    motion: fakeAdapter<MotionSample>({ beta: 0, gamma: 0, alpha: 0, magnitude: 0 }),
    audioIn: fakeAdapter<AudioSample>({ rms: 0 }),
    camera: fakeAdapter<CameraSample>({ brightness: 0.5 }),
    haptics: { available: opts.haptics ?? false, patterns: [] },
  };

  const p: LevelProps = {
    onSolve: vi.fn(),
    onFail: vi.fn(),
    rng: streamFor(opts.seed ?? 4242, id),
    chaos: [],
    degraded: Boolean(opts.fallback),
    input: {
      pointer: fakeAdapter({ x: 0, y: 0, id: -1, phase: "up" as const, count: 0 }),
      keyboard: fakeAdapter({ key: "", code: "", phase: "up" as const }),
      motion: rig.motion,
      audioIn: rig.audioIn,
      camera: rig.camera,
      haptics: {
        available: rig.haptics.available,
        pattern: (ms: readonly number[]) => rig.haptics.patterns.push([...ms]),
        onSilent: () => () => {},
      },
      has: () => true,
    } as unknown as LevelProps["input"],
    sfx: createSilentSfx(),
  };

  const Body = opts.fallback ? (mod.Fallback ?? mod.Component) : mod.Component;
  render(<Body {...p} />);
  return { ...p, rig };
}

/*
 * Every sensor level ships two paths, and both of them are the level.
 *
 * A fallback that is easier is a leaderboard exploit; a fallback that is
 * harder is a punishment for owning a laptop. Both get proved here, and the
 * shared-physics levels prove it by construction — one number goes in and the
 * rest of the level cannot tell where it came from.
 */

describe("every sensor level ships a fallback", () => {
  it("has one for each, because a run must survive every permission denied", () => {
    const sensors = CATALOG.filter((m) => m.family === "sensor");
    expect(sensors.length).toBeGreaterThanOrEqual(6);

    for (const meta of sensors) {
      const mod = BY_ID.get(meta.id)!;
      /* L26 is the exception, and deliberately: its flash-and-audio delivery is
         the majority path rather than a fallback, so it requires only a
         pointer and has nothing to degrade to. */
      if (meta.requires.every((r) => r === "pointer" || r === "keyboard")) continue;
      expect(mod.Fallback, `${meta.id} has no fallback`).toBeTruthy();
    }
  });
});

describe("L13 · Confirm With A Gesture", () => {
  /* The physics is pure, so the honest solve is provable without a browser. */
  it("pours a digit into its slot on a small tilt and a level-off", () => {
    let tray = freshTray(4);
    const target = slotX(0, 4);

    while ((tray.x[0] ?? 0) < target) tray = step(tray, 20, 16);
    tray = step(tray, 0, 16);
    expect(tray.seated[0]).toBe(true);
  });

  it("will not seat a digit while the tray is tilted", () => {
    let tray = freshTray(4);
    const target = slotX(0, 4);
    while ((tray.x[0] ?? 0) < target) tray = step(tray, 20, 16);
    /* Sitting right on the slot, still tilted — nothing drops. */
    expect(tray.seated[0]).toBe(false);
    expect(SETTLE_DEG).toBeGreaterThan(0);
  });

  /* One at a time: the others wait at the left rather than stacking on a pixel. */
  it("moves only the leading digit", () => {
    let tray = freshTray(4);
    for (let t = 0; t < 30; t++) tray = step(tray, 20, 16);
    expect(tray.x[0]).toBeGreaterThan(0);
    expect(tray.x[1]).toBe(0);
    expect(tray.x[2]).toBe(0);
  });

  /* Every digit has to be reachable, or the level is unwinnable at the far end. */
  it("can seat all four, which is the level", () => {
    let tray = freshTray(4);
    for (let guard = 0; guard < 4000 && !tray.seated.every(Boolean); guard++) {
      /* A player's actual strategy: nudge, level off, look, nudge again. */
      tray = step(tray, 12, 400);
      tray = step(tray, 0, 16);
    }
    expect(tray.seated).toEqual([true, true, true, true]);
  });

  it("solves through the gyroscope", () => {
    vi.useFakeTimers();
    const p = mount("L13");
    /* Two acts, not one. `useLatest` writes its ref in an effect, and effects
       flush at the end of an act() — pushing and advancing together would run
       the physics against the previous tilt. In a browser the effect lands long
       before the next 16ms tick. */
    const tilt = (gamma: number, ms: number) => {
      act(() => p.rig.motion.push({ beta: 0, gamma, alpha: 0, magnitude: 0 }));
      act(() => vi.advanceTimersByTime(ms));
    };

    /* Nudge, level off, look, nudge again — the honest solve. */
    for (let i = 0; i < 160 && (p.onSolve as ReturnType<typeof vi.fn>).mock.calls.length === 0; i++) {
      tilt(12, 400);
      tilt(0, 100);
    }
    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("solves identically through the on-screen phone", () => {
    vi.useFakeTimers();
    const p = mount("L13", { fallback: true });
    const dial = screen.getByLabelText("Tilt the device");

    for (let i = 0; i < 160 && (p.onSolve as ReturnType<typeof vi.fn>).mock.calls.length === 0; i++) {
      fireEvent.change(dial, { target: { value: "12" } });
      act(() => vi.advanceTimersByTime(400));
      fireEvent.change(dial, { target: { value: "0" } });
      act(() => vi.advanceTimersByTime(100));
    }
    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("spills the tray when it is held past the lip", () => {
    vi.useFakeTimers();
    const p = mount("L13", { fallback: true });
    fireEvent.change(screen.getByLabelText("Tilt the device"), { target: { value: "55" } });
    act(() => vi.advanceTimersByTime(600));
    expect(p.onFail).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("L14 · Please Confirm Verbally", () => {
  it("solves by holding the microphone in the band for three seconds", () => {
    vi.useFakeTimers();
    const p = mount("L14");
    act(() => p.rig.audioIn.push({ rms: 0.7 }));
    act(() => vi.advanceTimersByTime(3200));
    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("resets and objects when you shout at it", () => {
    vi.useFakeTimers();
    const p = mount("L14");
    act(() => p.rig.audioIn.push({ rms: 0.7 }));
    act(() => vi.advanceTimersByTime(500));
    act(() => p.rig.audioIn.push({ rms: 0.99 }));
    act(() => vi.advanceTimersByTime(200));

    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).toHaveBeenCalled();
    expect(screen.getByText("PLEASE DO NOT SHOUT AT THE FORM.")).toBeTruthy();
    vi.useRealTimers();
  });

  it("solves identically by holding the slider", () => {
    vi.useFakeTimers();
    const p = mount("L14", { fallback: true });
    const slider = screen.getByLabelText("Signal level");

    /* It falls on its own, so it has to be held — same as a note. */
    for (let i = 0; i < 70; i++) {
      fireEvent.change(slider, { target: { value: "0.7" } });
      act(() => vi.advanceTimersByTime(50));
    }
    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  /*
   * A granted-but-dead microphone is common, and leaving somebody humming at a
   * meter that can never move is the worst thing this level could do.
   */
  it("hands over the fallback when the microphone turns out to be dead", () => {
    vi.useFakeTimers();
    mount("L14");
    expect(screen.queryByLabelText("Signal level")).toBeNull();

    act(() => vi.advanceTimersByTime(4500));
    expect(screen.getByText(/We couldn.t hear you/)).toBeTruthy();
    expect(screen.getByLabelText("Signal level")).toBeTruthy();
    vi.useRealTimers();
  });
});

describe("L19 · Upload A Photo Of Yourself", () => {
  it("counts brightness jumps, which is why covering the lens works", () => {
    const p = mount("L19");
    for (let i = 0; i < 8; i++) {
      act(() => p.rig.camera.push({ brightness: i % 2 === 0 ? 0.2 : 0.8 }));
    }
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("ignores a slow drift, so a changing room does not solve it for you", () => {
    const p = mount("L19");
    for (let i = 0; i < 20; i++) {
      act(() => p.rig.camera.push({ brightness: 0.2 + i * 0.01 }));
    }
    expect(p.onSolve).not.toHaveBeenCalled();
  });

  it("solves by clicking the eyes of an ASCII face seven times", () => {
    const p = mount("L19", { fallback: true });
    for (let i = 0; i < 7; i++) {
      fireEvent.click(screen.getByLabelText(i % 2 ? "Blink the right eye" : "Blink the left eye"));
    }
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("resets the counter after four seconds of nothing", () => {
    vi.useFakeTimers();
    const p = mount("L19", { fallback: true });
    fireEvent.click(screen.getByLabelText("Blink the left eye"));
    act(() => vi.advanceTimersByTime(4500));

    expect(p.onFail).toHaveBeenCalled();
    expect(screen.getByText(/Liveness check timed out/)).toBeTruthy();
    vi.useRealTimers();
  });
});

describe("L20 · Confirm You're Nearby", () => {
  it("solves on three fingers held for three seconds", () => {
    vi.useFakeTimers();
    const p = mount("L20");
    const pad = screen.getByTestId("l20-pad");

    for (const pointerId of [1, 2, 3]) fireEvent.pointerDown(pad, { pointerId });
    act(() => vi.advanceTimersByTime(3200));
    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("starts over the moment a finger lifts", () => {
    vi.useFakeTimers();
    const p = mount("L20");
    const pad = screen.getByTestId("l20-pad");

    for (const pointerId of [1, 2, 3]) fireEvent.pointerDown(pad, { pointerId });
    act(() => vi.advanceTimersByTime(1500));
    fireEvent.pointerUp(pad, { pointerId: 2 });
    act(() => vi.advanceTimersByTime(200));

    expect(p.onFail).toHaveBeenCalled();
    expect(p.onSolve).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("will not solve on two fingers", () => {
    vi.useFakeTimers();
    const p = mount("L20");
    const pad = screen.getByTestId("l20-pad");
    for (const pointerId of [1, 2]) fireEvent.pointerDown(pad, { pointerId });
    act(() => vi.advanceTimersByTime(4000));
    expect(p.onSolve).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("solves on desktop with two mouse buttons and the space bar", () => {
    vi.useFakeTimers();
    const p = mount("L20", { fallback: true });
    const pad = screen.getByTestId("l20-pad");

    fireEvent.pointerDown(pad, { button: 0 });
    fireEvent.pointerDown(pad, { button: 2 });
    fireEvent.keyDown(window, { code: "Space" });
    act(() => vi.advanceTimersByTime(3200));

    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe("L26 · Emergency Verification", () => {
  const PATTERN: Beat[] = ["short", "short", "short", "long", "long"];

  it("accepts a rhythm within tolerance and rejects one outside it", () => {
    expect(matches(PATTERN, PATTERN.map(beatMs))).toBe(true);
    expect(matches(PATTERN, PATTERN.map((b) => beatMs(b) + 140))).toBe(true);
    expect(matches(PATTERN, PATTERN.map((b) => beatMs(b) + 400))).toBe(false);
    expect(matches(PATTERN, [160, 160])).toBe(false);
  });

  /*
   * No `navigator.vibrate` exists on any iOS Safari, so the flash-and-audio
   * delivery is the majority path. It has to be identical in difficulty, which
   * means the same pattern and the same tolerance either way.
   */
  it("delivers the pattern by vibration when the device can", () => {
    vi.useFakeTimers();
    const p = mount("L26", { haptics: true });
    expect(p.rig.haptics.patterns.length).toBe(1);
    expect(p.rig.haptics.patterns[0]!.length).toBe(PATTERN.length * 2 - 1);
    vi.useRealTimers();
  });

  it("delivers it by flashing when the device cannot vibrate", () => {
    vi.useFakeTimers();
    const p = mount("L26", { haptics: false });
    expect(p.rig.haptics.patterns.length).toBe(0);
    expect(screen.getByText(/flashed and beeped it instead/)).toBeTruthy();
    vi.useRealTimers();
  });

  it("solves when the rhythm is tapped back", () => {
    const p = mount("L26");
    const pad = screen.getByTestId("l26-pad");

    /* Wait out the playback, then tap the pattern with real held durations. */
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        let now = 1000;
        vi.spyOn(performance, "now").mockImplementation(() => now);
        for (const b of PATTERN) {
          fireEvent.pointerDown(pad);
          now += beatMs(b);
          fireEvent.pointerUp(pad);
          now += 50;
        }
        expect(p.onSolve).toHaveBeenCalledOnce();
        vi.restoreAllMocks();
        resolve();
      }, 2600);
    });
  }, 10_000);
});

describe("L35 · Please Stand Up", () => {
  it("means it — sustained movement is the only way through", () => {
    vi.useFakeTimers();
    const p = mount("L35");
    act(() => p.rig.motion.push({ beta: 0, gamma: 0, alpha: 0, magnitude: 18 }));
    act(() => vi.advanceTimersByTime(5000));
    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("is not fooled by sitting perfectly still at 1g", () => {
    vi.useFakeTimers();
    const p = mount("L35");
    act(() => p.rig.motion.push({ beta: 0, gamma: 0, alpha: 0, magnitude: 9.8 }));
    act(() => vi.advanceTimersByTime(6000));
    expect(p.onSolve).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("says so when you stop halfway", () => {
    vi.useFakeTimers();
    const p = mount("L35");
    act(() => p.rig.motion.push({ beta: 0, gamma: 0, alpha: 0, magnitude: 18 }));
    act(() => vi.advanceTimersByTime(1000));
    act(() => p.rig.motion.push({ beta: 0, gamma: 0, alpha: 0, magnitude: 9.8 }));
    act(() => vi.advanceTimersByTime(2000));

    expect(p.onFail).toHaveBeenCalled();
    expect(screen.getByText(/still seated/)).toBeTruthy();
    vi.useRealTimers();
  });

  /* The honour system is the better version and it is not guarded. */
  it("trusts you completely when there is no accelerometer", () => {
    vi.useFakeTimers();
    const p = mount("L35", { fallback: true });

    /* The box is locked until the six seconds are up — that is the only rule. */
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
    act(() => vi.advanceTimersByTime(6200));
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("Confirm"));
    expect(p.onSolve).toHaveBeenCalledOnce();
    expect(screen.getByText(/nothing checking this/)).toBeTruthy();
    vi.useRealTimers();
  });
});
