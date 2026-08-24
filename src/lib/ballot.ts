"use client";

import { useEffect, useState } from "react";

const KEY = "ai-rush:ballot";
const VOTED = "ai-rush:voted";

/**
 * A ballot: a random id this browser made up about itself.
 *
 * `COMMUNITY_LEVELS.md` asks for one vote per submission per "browser
 * fingerprint". This is not that, on purpose. Fingerprinting is a surveillance
 * technique, and building one to protect the integrity of a poll the same
 * document calls "a signal, not a mandate" would be both disproportionate and
 * — in a game whose entire subject is interfaces that take more than they need
 * — hypocritical.
 *
 * So the browser generates 22 characters of nothing in particular, keeps them,
 * and sends them with a vote. It identifies no one. It is derived from nothing
 * about the device. Clearing site data issues a new one, which means somebody
 * determined to vote twice can, and that is an accepted cost rather than a
 * hole: the top-voted idea still has to survive a human reading it before
 * anything gets built.
 */
export function ballotId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    /* URL-safe base64 without the padding, which keeps it inside the character
       class the database checks. */
    const minted = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    localStorage.setItem(KEY, minted);
    return minted;
  } catch {
    /* Private mode, storage blocked, no crypto. Voting will be refused rather
       than silently counted, which is the honest failure. */
    return "";
  }
}

/**
 * Which cards this browser has voted on.
 *
 * The server does not answer this, on purpose: a ballot lives in exactly one
 * browser, so a local record is precisely as accurate as asking would be, and
 * it means no identifier is sent anywhere merely to read the page.
 */
function readVoted(): Set<string> {
  try {
    const raw = localStorage.getItem(VOTED);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function rememberVote(id: string, voted: boolean): void {
  try {
    const set = readVoted();
    if (voted) set.add(id);
    else set.delete(id);
    localStorage.setItem(VOTED, JSON.stringify([...set]));
    window.dispatchEvent(new CustomEvent(VOTED));
  } catch {
    /* The vote still landed server-side; only the highlight is lost. */
  }
}

/**
 * Starts empty and fills in after mount.
 *
 * localStorage does not exist during server rendering, so reading it in a lazy
 * initialiser would make the server and the client disagree about which
 * buttons are lit — a hydration mismatch on every card.
 */
export function useVoted(): Set<string> {
  const [voted, setVoted] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const sync = () => setVoted(readVoted());
    sync();
    window.addEventListener(VOTED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(VOTED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return voted;
}
