"use client";

import { useEffect, useRef } from "react";

/**
 * The latest value of something, readable from inside a long-lived callback.
 *
 * Several levels run their mechanic on one interval that must not restart —
 * a tray of digits mid-slide, a three-second hold, a rhythm being played. The
 * interval closes over the render that created it, so it needs a way to read
 * the current tilt or level or callback without being torn down and rebuilt
 * every time one of them changes.
 *
 * Written in an effect rather than during render, deliberately. A ref mutated
 * while rendering is a genuine hazard: React may throw a render away, and the
 * ref would be left holding a value that never reached the screen. Effects
 * flush before any timer fires, so a callback always reads a value that was
 * really rendered.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
