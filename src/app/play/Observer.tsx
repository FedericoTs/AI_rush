"use client";

import { useEffect } from "react";
import { MARK_KINDS, MARKS, type Mark, type MarkKind } from "@/lib/playtest";
import s from "./observer.module.css";

/**
 * The facilitator's bar.
 *
 * Present only under `?observe=1`, and the player is not supposed to be the
 * one using it — the person running the session sits beside them and taps, or
 * holds Alt and hits a number on a laptop next to the phone.
 *
 * Two rules govern every choice in here:
 *
 * 1. **It must not touch the run.** The clock does not pause for it, the marks
 *    are not events, and nothing it does can reach a level. It is a stopwatch
 *    somebody is holding near the game.
 * 2. **It must not be usable by accident.** Bare digits would be typed
 *    straight into L02's passcode and L12's phone field, so every shortcut
 *    needs Alt, and the handler runs in the capture phase and stops the event
 *    dead rather than letting the level see a keystroke that was not for it.
 */
export function ObserverBar({
  levelId,
  marks,
  onMark,
}: {
  levelId: string;
  marks: Mark[];
  onMark: (kind: MarkKind) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const kind = MARK_KINDS.find((k) => MARKS[k].key === e.key);
      if (!kind) return;
      /* Alt+1 switches browser tabs on some platforms, and the level below is
         very much still listening. Neither gets a look in. */
      e.preventDefault();
      e.stopPropagation();
      onMark(kind);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onMark]);

  const count = (kind: MarkKind) => marks.filter((m) => m.kind === kind).length;
  const here = marks.filter((m) => m.levelId === levelId).length;

  return (
    <div className={s.bar} data-testid="observer-bar">
      <span className={s.tag}>
        OBSERVING
        <b>{levelId}</b>
        {here > 0 && <i>{here} here</i>}
      </span>

      <div className={s.keys}>
        {MARK_KINDS.map((kind) => (
          <button
            key={kind}
            className={s.key}
            data-kind={kind}
            data-testid={`mark-${kind}`}
            onClick={() => onMark(kind)}
            title={MARKS[kind].hint}
          >
            <span className={s.keyLabel}>{MARKS[kind].label}</span>
            <span className={s.keyHint}>⌥{MARKS[kind].key}</span>
            <span className={s.keyCount}>{count(kind)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The end of a session.
 *
 * Deliberately a download rather than an upload. A playtest recording is
 * somebody's face and voice; the file belongs next to the video on the
 * facilitator's disk, and a server that never receives it cannot leak it.
 */
export function ObserverExport({
  subject,
  onSubject,
  onExport,
  saved,
  marks,
}: {
  subject: string;
  onSubject: (v: string) => void;
  onExport: () => void;
  saved: boolean;
  marks: Mark[];
}) {
  const laughs = marks.filter((m) => m.kind === "laugh").length;

  return (
    <div className={s.export} data-testid="observer-export">
      <div className={s.exportHead}>
        <b>Session</b>
        <span>
          {laughs} {laughs === 1 ? "laugh" : "laughs"} ·{" "}
          {marks.filter((m) => m.kind === "confused").length} confused ·{" "}
          {marks.filter((m) => m.kind === "rage").length} rage
        </span>
      </div>

      <label className={s.field}>
        <span>Who was this?</span>
        <input
          value={subject}
          onChange={(e) => onSubject(e.target.value)}
          placeholder="P3 · iPhone 13 · never seen it"
          autoComplete="off"
          data-testid="observer-subject"
        />
      </label>

      <button className={s.save} onClick={onExport} data-testid="observer-save">
        {saved ? "Saved — download again" : "Save session file"}
      </button>

      <p className={s.exportNote}>
        Nothing here is uploaded. Drop the file next to the screen recording, then run{" "}
        <code>npm run playtest:report</code> over the folder when all five are done.
      </p>
    </div>
  );
}
