"use client";

import { useEffect, useState } from "react";
import type { InputCapability } from "@/engine/types";
import { detect, detectPassive } from "@/input/capabilities";
import s from "./calibrate.module.css";

const CHOICE_KEY = "ai-rush:sensors";

type Choice = "granted" | "declined";

/**
 * The one screen that asks for anything, before the clock starts.
 *
 * ── Why it has to exist, and why it has to be here ───────────────────────
 *
 * Six levels read a gyroscope, a microphone or a camera, and a browser will
 * not hand any of those over except inside a real user gesture. Without a
 * screen with a button on it, those levels can only ever render their
 * fallbacks — which is not "graceful degradation", it is half the content
 * being unreachable.
 *
 * And it has to be *before* the deal, not during it. The deck is dealt once
 * from the seed, and it needs to know what this device can do in order to
 * avoid handing somebody three fallback levels in a row. Asking mid-run would
 * also stop the clock, and the clock does not stop.
 *
 * ── What it will not do ──────────────────────────────────────────────────
 *
 * It will not block a run. Declining is one tap, it is remembered, and the
 * five minutes that follow are complete and fair — every sensor level ships a
 * fallback that is the same level with the same par, and two of them are
 * better than the originals. Mercy Mode skips this screen entirely, which is
 * what makes the front page's promise about microphones and cameras literally
 * true rather than nearly true.
 *
 * The answer is remembered so nobody is asked twice. That is the difference
 * between a game and a website.
 */
export function Calibrate({
  mercy,
  onDone,
}: {
  mercy: boolean;
  onDone: (caps: ReadonlySet<InputCapability>) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [ready, setReady] = useState(false);

  /*
   * Skip the screen entirely when there is nothing to ask about: a previous
   * answer, Mercy Mode, or a device with no sensors to offer. Running as an
   * effect rather than during render because it reads storage, and because
   * `onDone` starts a run.
   */
  useEffect(() => {
    if (mercy) {
      onDone(detectPassive());
      return;
    }

    let remembered: string | null = null;
    try {
      remembered = localStorage.getItem(CHOICE_KEY);
    } catch {
      /* Private mode. Ask again; one extra tap is not a disaster. */
    }

    if (remembered === "declined") {
      onDone(detectPassive());
      return;
    }
    if (remembered === "granted") {
      /* Permissions already agreed to once are re-granted without a prompt, so
         this is silent — but it still has to be asked for, because the browser
         hands nothing over until it is. */
      void detect({ requestPermissions: true, wants: { motion: true, audioIn: true, camera: true } })
        .then(onDone)
        .catch(() => onDone(detectPassive()));
      return;
    }

    /*
     * This has to be an effect and it has to set state.
     *
     * The answer lives in localStorage, which does not exist during server
     * rendering — a lazy initialiser that read it would make the server and
     * the client disagree about whether this screen is even shown. Deciding
     * after mount is the correct shape for client-only storage, so the rule is
     * off here on purpose rather than worked around.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mercy]);

  const remember = (choice: Choice) => {
    try {
      localStorage.setItem(CHOICE_KEY, choice);
    } catch {
      /* Nothing to do, and nothing worth telling anybody about. */
    }
  };

  const allow = async () => {
    setAsking(true);
    remember("granted");
    try {
      /* One gesture, three prompts, in a row. Sequenced by `detect` so the
         browser does not collapse them into one refusal. */
      onDone(
        await detect({
          requestPermissions: true,
          wants: { motion: true, audioIn: true, camera: true },
        }),
      );
    } catch {
      onDone(detectPassive());
    }
  };

  const decline = () => {
    remember("declined");
    onDone(detectPassive());
  };

  if (!ready) {
    return (
      <div className={s.shell}>
        <div className={s.wait} />
      </div>
    );
  }

  return (
    <div className={s.shell}>
      <div className={s.card}>
        <span className={s.eyebrow}>Before the clock starts</span>
        <h1 className={s.title}>
          Six of these levels use
          <br />
          your phone against you.
        </h1>

        <p className={s.body}>
          Motion, microphone and camera. One of them asks you to stand up in public. One asks you
          to hum. One counts your blinks and will happily settle for a finger over the lens.
        </p>

        <ul className={s.facts}>
          <li>Nothing is recorded. Nothing is uploaded. Nothing leaves this device.</li>
          <li>Streams are closed the moment a level ends — always, no exceptions.</li>
          <li>
            Say no and you still get a full five minutes. Every one of those levels has a version
            that needs none of it, at the same difficulty, and two of them are better.
          </li>
        </ul>

        <div className={s.row}>
          <button type="button" className={s.decline} onClick={decline} disabled={asking}>
            No sensors
          </button>
          <button type="button" className={s.allow} onClick={() => void allow()} disabled={asking}>
            {asking ? "Check your browser…" : "Allow"}
          </button>
        </div>

        <p className={s.fine}>
          Your browser will ask separately for each one, and you can refuse any of them
          individually. We remember whichever you pick, so this is the last time you see this
          screen.
        </p>
      </div>
    </div>
  );
}
