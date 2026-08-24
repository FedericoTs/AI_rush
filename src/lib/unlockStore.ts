"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_CREDITS, type UnlockState } from "@/engine/unlocks";

const KEY = "ai-rush:unlocks";

/**
 * What this browser has opened, and the key that proves the sharing half.
 *
 * ── Why a bearer key and not an account ──────────────────────────────────
 *
 * There are no accounts here and there is not going to be. Handles are typed,
 * not verified — anyone can claim to be anyone — so a handle cannot own
 * anything. The referral key can: it is minted server-side when a run is
 * claimed, it is the only thing that can read a credit count, and it is the
 * thing that travels inside a share link.
 *
 * Which means a lost key is a lost unlock, and that is why the key is shown to
 * the player as a restore code and is recoverable from any link they have
 * already posted. Their own share is their backup.
 */
export interface LocalUnlocks extends UnlockState {
  /** Minted server-side at claim time. Absent until the player claims a run. */
  key: string | null;
}

export const EMPTY: LocalUnlocks = { credits: 0, secret: false, key: null };

function read(): LocalUnlocks {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LocalUnlocks>;
    return {
      credits: Math.max(0, Math.min(MAX_CREDITS, Math.floor(Number(parsed.credits)) || 0)),
      secret: parsed.secret === true,
      key: typeof parsed.key === "string" && parsed.key.length > 0 ? parsed.key : null,
    };
  } catch {
    /* Private mode, cleared storage, a value from a future version — start
       clean rather than crash. Losing an unlock is survivable; a level index
       that throws on load is not. */
    return EMPTY;
  }
}

function write(next: LocalUnlocks): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    /* Storage events only fire in *other* tabs, so same-tab listeners need
       telling directly — the footer that unlocks the secret and the index
       that renders it are frequently the same page. */
    window.dispatchEvent(new CustomEvent(KEY));
  } catch {
    /* Nothing to do and nothing worth telling the player about. */
  }
}

export function currentUnlocks(): LocalUnlocks {
  if (typeof window === "undefined") return EMPTY;
  return read();
}

/** Found, not earned. Returns true only the first time. */
export function findSecret(): boolean {
  if (typeof window === "undefined") return false;
  const now = read();
  if (now.secret) return false;
  write({ ...now, secret: true });
  return true;
}

export function rememberKey(key: string): void {
  if (typeof window === "undefined") return;
  write({ ...read(), key });
}

export function setCredits(credits: number): void {
  if (typeof window === "undefined") return;
  const now = read();
  const n = Math.max(0, Math.min(MAX_CREDITS, Math.floor(credits) || 0));
  if (n === now.credits) return;
  write({ ...now, credits: n });
}

/**
 * Subscribe to this browser's unlock state.
 *
 * Starts empty and fills in after mount, deliberately: localStorage does not
 * exist during server rendering, and a lazy initialiser that read it would
 * make the server and the client disagree about what is unlocked — which is a
 * hydration mismatch on every page that shows a level.
 */
export function useUnlocks(): LocalUnlocks {
  const [state, setState] = useState<LocalUnlocks>(EMPTY);

  useEffect(() => {
    const sync = () => setState(read());
    sync();
    window.addEventListener(KEY, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(KEY, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return state;
}

/**
 * Ask the server how many people have actually turned up, and cache it.
 *
 * The count is never asserted by the client — this reads a number the database
 * computed from real, validated runs. If the request fails the cached value
 * stands, because a flaky network should not take somebody's content away.
 */
export function useRefreshedCredits(key: string | null): void {
  const refresh = useCallback(async () => {
    if (!key) return;
    try {
      const res = await fetch(`/api/unlocks?k=${encodeURIComponent(key)}`);
      const data = (await res.json()) as { credits?: number };
      if (typeof data.credits === "number") setCredits(data.credits);
    } catch {
      /* Keep what we had. */
    }
  }, [key]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
}
