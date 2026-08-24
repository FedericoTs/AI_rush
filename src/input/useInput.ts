"use client";

import { useEffect, useMemo, useRef } from "react";
import type { InputCapability } from "@/engine/types";
import type { Adapter, AudioSample, CameraSample, KeySample, MotionSample, PointerSample } from "./adapters/types";
import { createPointerAdapter } from "./adapters/pointer";
import { createKeyboardAdapter } from "./adapters/keyboard";
import { createMotionAdapter } from "./adapters/motion";
import { createAudioInAdapter } from "./adapters/audioIn";
import { createCameraAdapter } from "./adapters/camera";
import { createHapticsAdapter, type HapticsHandle } from "./adapters/haptics";

export interface InputHandle {
  pointer: Adapter<PointerSample>;
  keyboard: Adapter<KeySample>;
  motion: Adapter<MotionSample> | null;
  audioIn: Adapter<AudioSample> | null;
  camera: Adapter<CameraSample> | null;
  haptics: HapticsHandle;
  has(cap: InputCapability): boolean;
}

const NULL_ADAPTER = <T,>(value: T): Adapter<T> => ({
  subscribe: () => () => {},
  current: () => value,
  destroy: () => {},
});

/**
 * A level declares what it needs; it gets a normalised handle. Adapters that
 * cannot exist on this device come back null, and the level renders its
 * degraded path — it never waits, never prompts, never blocks the run.
 */
export function useInput(
  needs: readonly InputCapability[],
  capabilities: ReadonlySet<InputCapability>,
): InputHandle {
  const asyncRef = useRef<{ audioIn: Adapter<AudioSample> | null; camera: Adapter<CameraSample> | null }>({
    audioIn: null,
    camera: null,
  });

  const needsKey = needs.join(",");

  const handle = useMemo<InputHandle>(() => {
    const wants = (c: InputCapability) => needs.includes(c) && capabilities.has(c);
    return {
      pointer: needs.includes("pointer") || needs.includes("touch")
        ? createPointerAdapter()
        : NULL_ADAPTER<PointerSample>({ x: 0, y: 0, id: -1, phase: "up", count: 0 }),
      keyboard: needs.includes("keyboard")
        ? createKeyboardAdapter()
        : NULL_ADAPTER<KeySample>({ key: "", code: "", phase: "up" }),
      motion: wants("motion") ? createMotionAdapter() : null,
      audioIn: null,
      camera: null,
      haptics: createHapticsAdapter(),
      has: (cap) => capabilities.has(cap),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilities, needsKey]);

  /* Media streams are async and must be torn down the instant the level
     unmounts — see the performance budget in ARCHITECTURE.md §9. */
  useEffect(() => {
    let cancelled = false;
    const store = asyncRef.current;

    if (needs.includes("audioIn") && capabilities.has("audioIn")) {
      void createAudioInAdapter().then((a) => {
        if (cancelled) return a.destroy();
        store.audioIn = a;
        handle.audioIn = a;
      });
    }
    if (needs.includes("camera") && capabilities.has("camera")) {
      void createCameraAdapter().then((a) => {
        if (cancelled) return a.destroy();
        store.camera = a;
        handle.camera = a;
      });
    }

    return () => {
      cancelled = true;
      store.audioIn?.destroy();
      store.camera?.destroy();
      store.audioIn = null;
      store.camera = null;
      handle.pointer.destroy();
      handle.keyboard.destroy();
      handle.motion?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  return handle;
}
