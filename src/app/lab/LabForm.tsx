"use client";

import { useEffect, useRef, useState } from "react";
import s from "./lab.module.css";

const INPUTS = [
  { id: "touch", label: "Touch" },
  { id: "mouse", label: "Mouse" },
  { id: "keyboard", label: "Keyboard" },
  { id: "tilt", label: "Tilt / gyro" },
  { id: "mic", label: "Microphone" },
  { id: "camera", label: "Camera" },
  { id: "vibration", label: "Vibration" },
  { id: "sound", label: "Sound" },
] as const;

const DRAFT_KEY = "ai-rush:lab-draft";

interface Draft {
  handle: string;
  title: string;
  parodies: string;
  mechanic: string;
  inputs: string[];
}

const EMPTY: Draft = { handle: "@", title: "", parodies: "", mechanic: "", inputs: [] };

/**
 * The one form in this product that is not trying to hurt anyone.
 *
 * Real labels, real focus rings, real error messages, a draft kept while you
 * type. That is not a joke at the player's expense — it is the whole content
 * pipeline, and every point of friction here is an idea that never arrives.
 *
 * The mechanic field asks for the honest solve on purpose. Describing only the
 * cruelty and not the escape is the single most common failure in a
 * submission, and asking directly fixes most of it.
 */
export function LabForm() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const loaded = useRef(false);

  /*
   * Restore the draft. Losing a submission to a closed tab would be, in this
   * particular product, an unbearable irony.
   *
   * This has to be an effect: localStorage does not exist during server
   * rendering, and a lazy initialiser that reads it would make the server and
   * the client disagree about the value of every input. Hydrating after mount
   * is the correct shape for client-only storage, so the rule is off here on
   * purpose rather than worked around.
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setDraft({ ...EMPTY, ...(JSON.parse(saved) as Partial<Draft>) });
    } catch {
      /* private mode, cleared storage, anything — start blank and carry on */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current || done) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* nothing to do, and nothing worth telling the player about */
    }
  }, [draft, done]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleInput = (id: string) =>
    setDraft((d) => ({
      ...d,
      inputs: d.inputs.includes(id) ? d.inputs.filter((i) => i !== id) : [...d.inputs, id],
    }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setField(null);
    try {
      const res = await fetch("/api/lab/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as { ok?: boolean; reason?: string; field?: string };
      if (data.ok) {
        setDone(true);
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* the submission landed; storage is not worth an error */
        }
        return;
      }
      setField(data.field ?? null);
      setError(
        data.reason === "offline"
          ? "Submissions are not available on this build."
          : (data.reason ?? "That did not go through. Try again?"),
      );
    } catch {
      setError("Could not reach the server. Your draft is saved — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={s.done}>
        <h2>Filed. 🧪</h2>
        <p>
          A human reads these on Fridays. If yours gets built, your handle goes on it — in the
          level, in the index, and on the share card of everyone it destroys.
        </p>
        <div className={s.doneRow}>
          <a className={s.primary} href="/play">
            Take your five minutes
          </a>
          <button
            className={s.secondary}
            type="button"
            onClick={() => {
              setDraft({ ...EMPTY, handle: draft.handle });
              setDone(false);
            }}
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate>
      <div className={s.field}>
        <label htmlFor="lab-title">What does the interface call itself?</label>
        <input
          id="lab-title"
          value={draft.title}
          maxLength={80}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Verify Your Humanity™"
          aria-invalid={field === "title"}
        />
        <span className={s.help}>The title a player sees at the top of the card.</span>
      </div>

      <div className={s.field}>
        <label htmlFor="lab-parodies">What normal UI is it pretending to be?</label>
        <input
          id="lab-parodies"
          value={draft.parodies}
          maxLength={120}
          onChange={(e) => set("parodies", e.target.value)}
          placeholder="A cookie banner. A date picker. A checkout form."
          aria-invalid={field === "parodies"}
        />
        <span className={s.help}>
          It has to look ordinary for the first second and a half. That gap is the joke.
        </span>
      </div>

      <div className={s.field}>
        <label htmlFor="lab-mechanic">What does it do to the player?</label>
        <textarea
          id="lab-mechanic"
          value={draft.mechanic}
          maxLength={1200}
          rows={7}
          onChange={(e) => set("mechanic", e.target.value)}
          placeholder={
            "Be specific. And say how someone beats it — every level has to be survivable in under a minute.\n\nThe most common thing missing from a submission is the escape, not the cruelty."
          }
          aria-invalid={field === "mechanic"}
        />
        <span className={s.help}>
          {draft.mechanic.length}/1200 · include the honest solve, or it cannot be built
        </span>
      </div>

      <fieldset className={s.field}>
        <legend>What does it need? (optional)</legend>
        <div className={s.chips}>
          {INPUTS.map((i) => (
            <button
              key={i.id}
              type="button"
              className={`${s.chip} ${draft.inputs.includes(i.id) ? s.chipOn : ""}`}
              aria-pressed={draft.inputs.includes(i.id)}
              onClick={() => toggleInput(i.id)}
            >
              {i.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className={s.field}>
        <label htmlFor="lab-handle">Where do we credit you?</label>
        <input
          id="lab-handle"
          value={draft.handle}
          maxLength={16}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) =>
            set("handle", e.target.value.startsWith("@") ? e.target.value : `@${e.target.value}`)
          }
          aria-invalid={field === "handle"}
        />
        <span className={s.help}>Your X handle. It goes on the level if it ships.</span>
      </div>

      {error && (
        <div className={s.error} role="alert" data-testid="lab-error">
          {error}
        </div>
      )}

      <button className={s.primary} type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send it in"}
      </button>
      <p className={s.fine}>
        No account, no email, no confirmation link. Your draft is kept in this browser while you
        type.
      </p>
    </form>
  );
}
