import type { RunEvent } from "@/engine/scoring";
import type { LevelResult, Tier } from "@/engine/types";

/**
 * The observer's side of a playtest.
 *
 * `ROADMAP.md` Phase 2 asks for five people, screen recorded, counting laughs
 * and noting every moment of confused silence — and then rebalancing par times
 * from the recordings. Everything in that sentence except "watch a recording"
 * is data entry, and data entry done from memory an hour later is fiction.
 *
 * So the facilitator tags moments live, against the same clock the run is
 * scored on. A laugh at 2:14 lands next to the solve at 2:14, and the report
 * can say which level earned it without anyone scrubbing a video.
 *
 * This is deliberately not telemetry. It is never sent anywhere, never
 * written to the database, and only exists when somebody has typed `observe=1`
 * into the address bar — it is a clipboard, not a tracker.
 */

export type MarkKind = "laugh" | "confused" | "rage" | "note";

export interface Mark {
  /** Milliseconds into the run, on the run's own clock. */
  atMs: number;
  kind: MarkKind;
  /** Whatever was on screen when it happened. */
  levelId: string;
}

export interface MarkSpec {
  label: string;
  /** What the facilitator is actually looking for. Shown in the bar. */
  hint: string;
  /** Pressed with Alt. Digits alone would be typed into half the levels. */
  key: string;
}

/**
 * Four buttons, and only four.
 *
 * A richer taxonomy sounds better and performs worse: the person pressing
 * these is also watching a stranger's face, and anything that needs a decision
 * gets pressed late or not at all.
 *
 * `confused` is the important one. The protocol's actual claim is that
 * confused silence — not difficulty — is the failure mode, so it gets equal
 * billing with the laugh rather than being a sub-case of a frown.
 */
export const MARKS: Record<MarkKind, MarkSpec> = {
  laugh: { label: "Laugh", hint: "out loud, not a smile", key: "1" },
  confused: { label: "Confused", hint: "silence, re-reading, stuck without trying", key: "2" },
  rage: { label: "Rage", hint: "annoyed at the game, not at the joke", key: "3" },
  note: { label: "Mark", hint: "anything worth scrubbing back to", key: "4" },
};

export const MARK_KINDS = Object.keys(MARKS) as MarkKind[];

/** Enough of a level to read the report without the codebase in front of you. */
export interface SessionLevel {
  id: string;
  title: string;
  tier: Tier;
  parSeconds: number;
}

export interface PlaytestSession {
  version: 1;
  /** Free text the facilitator types: "P3, iPhone 13, never seen it". */
  subject: string;
  seed: string;
  mercy: boolean;
  durationMs: number;
  score: number;
  killedBy: string | null;
  /** The deck as dealt, so the report needs nothing else to interpret itself. */
  levels: SessionLevel[];
  marks: Mark[];
  events: RunEvent[];
  breakdown: LevelResult[];
}

/**
 * A filename that sorts by when it happened and says who it was.
 *
 * `now` is passed in rather than read, so this stays a pure function and the
 * tests do not have to freeze a clock to check it.
 */
export function sessionFilename(session: Pick<PlaytestSession, "subject" | "seed">, now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const who = session.subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `playtest-${stamp}-${who || session.seed}.json`;
}

/** Hand the facilitator the file. Browser-only; the caller guards for that. */
export function downloadSession(session: PlaytestSession, filename: string): void {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
