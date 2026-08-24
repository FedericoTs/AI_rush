/**
 * What this device can actually do.
 *
 * Detected once, during Calibration, before the clock starts — which is the
 * only reason Calibration exists. iOS needs a user gesture to even ask for
 * motion, and the deck needs the answer *before* it deals so a run never
 * contains three fallback levels in a row.
 *
 * Hard rule (GAME_DESIGN.md P5): a player who denies every permission gets a
 * complete, fair five minutes. Nothing here may ever block a run.
 */

import type { InputCapability } from "@/engine/types";

export type CapabilitySet = Set<InputCapability>;

interface MotionPermissionCtor {
  requestPermission?: () => Promise<"granted" | "denied">;
}

export interface DetectOptions {
  /** Ask for motion/mic/camera. Only true behind a real user gesture. */
  requestPermissions?: boolean;
  /** Which permission levels the dealt deck will actually need. */
  wants?: { motion?: boolean; audioIn?: boolean; camera?: boolean };
}

/** Capabilities we can know without asking anyone for anything. */
export function detectPassive(): CapabilitySet {
  const caps: CapabilitySet = new Set();
  if (typeof window === "undefined") return caps;

  caps.add("pointer");
  caps.add("audioOut"); // assumed; the visual fallback for L29 ships regardless

  if (typeof navigator !== "undefined") {
    if (navigator.maxTouchPoints > 0) caps.add("touch");
    if (navigator.maxTouchPoints >= 3) caps.add("multitouch");
    if ("vibrate" in navigator) caps.add("haptics"); // false on all iOS Safari
    if ("clipboard" in navigator) caps.add("clipboard");
    if (typeof navigator.getGamepads === "function") caps.add("gamepad");
  }

  /* A keyboard cannot be feature-detected. Assume one unless the device is
     touch-primary, and let levels degrade rather than gate on it. */
  if (!window.matchMedia?.("(pointer: coarse)").matches) caps.add("keyboard");
  if ("DeviceOrientationEvent" in window) caps.add("orientation");

  return caps;
}

export async function detect(opts: DetectOptions = {}): Promise<CapabilitySet> {
  const caps = detectPassive();
  if (typeof window === "undefined" || !opts.requestPermissions) return caps;
  const wants = opts.wants ?? { motion: true };

  if (wants.motion && "DeviceMotionEvent" in window) {
    const ctor = window.DeviceMotionEvent as unknown as MotionPermissionCtor;
    if (typeof ctor.requestPermission === "function") {
      try {
        if ((await ctor.requestPermission()) === "granted") caps.add("motion");
      } catch {
        /* denied or not in a gesture. a non-event. */
      }
    } else {
      caps.add("motion");
    }
  }

  if (wants.audioIn && (await probeMedia({ audio: true }, true))) caps.add("audioIn");
  if (wants.camera && (await probeMedia({ video: true }, false))) caps.add("camera");

  return caps;
}

/**
 * Open a stream, confirm it is alive, close it again.
 *
 * `requireSignal` exists because a granted-but-dead microphone is common —
 * muted hardware, an OS-level block, a virtual device. Treating that as
 * "available" strands the player on a level that can never be solved, so a
 * mic that produces no signal within the window counts as unavailable.
 */
async function probeMedia(constraints: MediaStreamConstraints, requireSignal: boolean) {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (!requireSignal) return true;
    return await hasAudioSignal(stream, 4000);
  } catch {
    return false;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

function hasAudioSignal(stream: MediaStream, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return resolve(false);

    const ctx = new Ctor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const deadline = performance.now() + timeoutMs;

    const poll = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      if (Math.sqrt(sum / buf.length) > 0.001) {
        void ctx.close();
        return resolve(true);
      }
      if (performance.now() > deadline) {
        void ctx.close();
        return resolve(false);
      }
      requestAnimationFrame(poll);
    };
    poll();
  });
}
