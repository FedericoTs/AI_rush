"use client";

import { useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading, SlopHint } from "@/ui/slop/Slop";
import { FOOTER_LINKS } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const EXPIRY = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

/**
 * A checkout form on a card that rotates six degrees a second.
 *
 * Fully inverted after thirty seconds, still going after that. The rotation is
 * a transform on the container, so hit areas turn with the pixels — the button
 * really is where it appears to be, and clicking where it *used* to be does
 * nothing. Anything less would be a picture of the joke.
 *
 * The honest solve is to work fast, and the accidental one is to tilt your
 * head, which everybody does within about eight seconds and which works
 * perfectly. On a phone, physically turning the device to cancel the rotation
 * out is a real strategy and enormously satisfying.
 *
 * Reduced motion gets a static thirty-degree tilt instead of the spin. It is
 * still an awkward form at an awkward angle — the level survives — and a
 * continuously rotating viewport is exactly the thing that preference exists
 * to prevent.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [target] = useState(() => ({
    last4: String(rng.range(1000, 9999)),
    month: rng.pick(EXPIRY),
  }));
  const [digits, setDigits] = useState("");
  const [month, setMonth] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (digits === target.last4 && month === target.month) {
      sfx.solve();
      onSolve();
      return;
    }
    sfx.fail();
    onFail("wrong-card");
    setError("That doesn't match the card on file. Please check and try again. 💳");
    setDigits("");
  };

  return (
    <div className={s.spin}>
      <SlopCard>
        <SlopBadge>Checkout · SOC2 (pending)</SlopBadge>
        <SlopHeading>Confirm your payment method 💳</SlopHeading>

        <p className={s.ask}>
          For your security, re-enter the last four digits and expiry month of the card ending{" "}
          <b>{target.last4}</b>, expiring <b>{target.month}</b>.
        </p>

        <label className={s.label} htmlFor="l33-digits">
          Last four digits
        </label>
        <input
          id="l33-digits"
          className={s.input}
          inputMode="numeric"
          maxLength={4}
          value={digits}
          autoComplete="off"
          onChange={(e) => {
            setDigits(e.target.value.replace(/\D/g, "").slice(0, 4));
            sfx.blip();
          }}
        />

        <label className={s.label} htmlFor="l33-month">
          Expiry month
        </label>
        <select
          id="l33-month"
          className={s.input}
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            sfx.click();
          }}
        >
          <option value="">Select…</option>
          {EXPIRY.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <button type="button" className={s.cta} onClick={submit}>
          Pay Now
        </button>

        <SlopError>{error}</SlopError>
        <SlopHint>
          Our checkout adapts to your device orientation for a more natural experience. 🔄
        </SlopHint>
        <SlopFooter links={FOOTER_LINKS} />
      </SlopCard>
    </div>
  );
}

export const L33: LevelModule = { meta, Component };
