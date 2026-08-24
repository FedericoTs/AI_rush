"use client";

import { useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const EMOJI = ["🚀", "✨", "🔥", "💜", "🧠", "🦖", "📈", "🫡"];

/** Code points, not UTF-16 units — an emoji is one character to a human. */
const chars = (value: string): string[] => [...value];

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const countVowels = (value: string) =>
  chars(value).filter((c) => VOWELS.has(c.toLowerCase())).length;

const isPrime = (n: number) => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};

export interface Rule {
  id: string;
  label: string;
  ok(value: string): boolean;
}

/**
 * The rule set, built from the seed.
 *
 * Two of these would normally reach for the clock — "today's day of the week"
 * — and levels are forbidden from doing that, because a level that reads the
 * wall clock is a level that cannot be reproduced from a seed link. The day is
 * drawn from the run's RNG instead, which is both reproducible and, if
 * anything, funnier: the form is confidently wrong about what day it is.
 */
export function buildRules(day: string, length: number, emoji: readonly string[]): Rule[] {
  return [
    { id: "len", label: "At least 8 characters", ok: (v) => chars(v).length >= 8 },
    { id: "upper", label: "At least one capital letter", ok: (v) => /[A-Z]/.test(v) },
    {
      id: "vowels",
      label: "A prime number of vowels",
      ok: (v) => isPrime(countVowels(v)),
    },
    {
      id: "day",
      label: `Must not contain “${day}” (today)`,
      ok: (v) => !v.toLowerCase().includes(day.toLowerCase()),
    },
    {
      id: "exact",
      label: `Must be exactly ${length} characters long`,
      ok: (v) => chars(v).length === length,
    },
    {
      id: "emoji",
      label: `Must contain one trending emoji: ${emoji.join(" ")}`,
      ok: (v) => emoji.some((e) => v.includes(e)),
    },
  ];
}

/**
 * The classic, escalated.
 *
 * Every rule here is satisfiable, all six at once, and the checklist never
 * lies — which is the whole design. The cruelty is that they interact: the
 * exact-length rule pins the answer, the prime-vowel rule constrains what you
 * can pad it with, and the emoji costs you one of your characters. It stops
 * being guesswork about ten seconds in and becomes a small
 * constraint-satisfaction puzzle, which is a much better thing to be stuck on.
 *
 * Rules also un-satisfy. Getting the vowel count right and then adding one
 * more letter takes the tick away again, and watching a green row turn grey
 * because of a keystroke you thought was progress is the actual experience of
 * every password field ever shipped.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [day] = useState(() => rng.pick(DAYS));
  const [length] = useState(() => rng.range(11, 14));
  const [emoji] = useState(() => rng.shuffle(EMOJI).slice(0, 3));
  const [rules] = useState(() => buildRules(day, length, emoji));
  const [value, setValue] = useState("");
  const [sub] = useState(() => slopSubhead(rng));
  const [tried, setTried] = useState(false);

  const passing = rules.map((r) => r.ok(value));
  const allOk = passing.every(Boolean);

  const submit = () => {
    if (allOk) {
      sfx.solve();
      onSolve();
      return;
    }
    setTried(true);
    sfx.fail();
    onFail("requirements");
  };

  return (
    <SlopCard>
      <SlopBadge>Security · Bank-Level Security</SlopBadge>
      <SlopHeading>Choose a strong password 🔒</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <label className={s.label} htmlFor="l06-pw">
        Password
      </label>
      <input
        id="l06-pw"
        className={s.input}
        value={value}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) => {
          setValue(e.target.value);
          sfx.blip();
        }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />

      <div className={s.count}>
        {chars(value).length} characters · {countVowels(value)} vowels
      </div>

      <ul className={s.rules}>
        {rules.map((r, i) => (
          <li
            key={r.id}
            className={`${s.rule} ${passing[i] ? s.ruleOk : ""}`}
            data-rule={r.id}
            data-ok={passing[i] ? "yes" : "no"}
          >
            <span className={s.mark} aria-hidden="true">
              {passing[i] ? "✅" : "⬜"}
            </span>
            <span>{r.label}</span>
          </li>
        ))}
      </ul>

      {/* Never disabled. A greyed-out button tells you there is a problem;
          this one lets you commit and then explains, which is both worse and
          much closer to what these forms actually do. */}
      <button type="button" className={s.cta} onClick={submit}>
        Create Account
      </button>

      {tried && !allOk && (
        <div className={s.nag} role="status">
          Almost! {passing.filter((p) => !p).length} requirement
          {passing.filter((p) => !p).length === 1 ? "" : "s"} to go. You&rsquo;ve got this. 💪
        </div>
      )}

      <SlopHint>
        These requirements are generated by our AI to reflect current threat intelligence and may
        update in real time. Your password is never stored in plain text, only in ours. 🛡️
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L06: LevelModule = { meta, Component };
