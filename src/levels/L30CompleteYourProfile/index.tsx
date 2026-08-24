"use client";

import { useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const STEPS = ["You", "Workspace", "Team", "Review"] as const;

/**
 * A wizard whose Back button is a shredder.
 *
 * Four steps. Step 2 asks for a workspace code that is only shown on step 3.
 * Step 4's **Back** returns you to step 1 and clears steps 2 and 3 on the way —
 * so the obvious loop is: reach 3, learn the code, go back, lose the code.
 *
 * The progress dots along the top navigate without clearing anything. They have
 * been there since the first frame, they look like a progress indicator because
 * that is what they are pretending to be, and nobody presses them. Everyone
 * presses Back.
 *
 * No fail state beyond losing your work, repeatedly, until the dots are found.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [code] = useState(() => `WS-${rng.range(1000, 9999)}`);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [entered, setEntered] = useState("");
  const [wipes, setWipes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  /* Step 4's Back. The whole level. */
  const wipe = () => {
    setStep(0);
    setEntered("");
    setWipes((n) => n + 1);
    setError("Returned to the start. Some answers could not be preserved.");
    onFail("wizard-wiped");
    sfx.fail();
  };

  const back = () => {
    if (step === 3) return wipe();
    setStep((n) => Math.max(0, n - 1));
    sfx.blip();
  };

  const forward = () => {
    setError(null);
    if (step < STEPS.length - 1) {
      setStep((n) => n + 1);
      sfx.blip();
      return;
    }
    if (entered.trim().toUpperCase() === code) {
      onSolve();
      return;
    }
    setError("That workspace code doesn't match. You can find it on the Team step.");
    onFail("wrong-code");
    sfx.fail();
  };

  return (
    <SlopCard>
      <SlopBadge>Onboarding · Enterprise-Ready</SlopBadge>
      <SlopHeading>Complete Your Profile 🎯</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      {/* Real navigation, dressed as decoration. */}
      <div className={s.dots} role="tablist" aria-label="Progress">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={i === step}
            aria-label={`Step ${i + 1}: ${label}`}
            className={`${s.dot} ${i === step ? s.dotOn : ""} ${i < step ? s.dotDone : ""}`}
            onClick={() => { setStep(i); setError(null); sfx.blip(); }}
            data-testid={`dot-${i}`}
          >
            <i />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className={s.pane} data-testid={`step-${step}`}>
        {step === 0 && (
          <label className={s.row}>
            <span>What should we call you?</span>
            <input
              className={s.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="off"
              data-testid="field-name"
            />
          </label>
        )}

        {step === 1 && (
          <label className={s.row}>
            <span>Workspace code</span>
            <input
              className={s.input}
              value={entered}
              onChange={(e) => setEntered(e.target.value)}
              placeholder="WS-0000"
              autoComplete="off"
              data-testid="field-code"
            />
            <em className={s.help}>You&apos;ll find this on your team&apos;s page.</em>
          </label>
        )}

        {step === 2 && (
          <div className={s.row}>
            <span>Your team</span>
            <div className={s.codeCard}>
              <b data-testid="workspace-code">{code}</b>
              <em>Workspace code — you&apos;ll need this on the previous step.</em>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={s.row}>
            <span>Review</span>
            <div className={s.review}>
              <div><i>Name</i><b>{name || "—"}</b></div>
              <div><i>Workspace</i><b>{entered || "—"}</b></div>
              {wipes > 0 && <div><i>Restarts</i><b>{wipes}</b></div>}
            </div>
          </div>
        )}
      </div>

      <div className={s.nav}>
        <button type="button" className={s.back} onClick={back} data-testid="back">
          Back
        </button>
        <SlopCta onClick={forward}>{step === STEPS.length - 1 ? "Finish" : "Next"}</SlopCta>
      </div>

      <SlopError>{error}</SlopError>
      <SlopHint>
        Your progress is saved automatically at every step. 💾
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L30: LevelModule = { meta, Component };
