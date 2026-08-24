"use client";

import { useMemo, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const CORRECT = "221B Baker Street, London";

const CANDIDATES = [
  CORRECT,
  "14 Rue de la Paix, Paris",
  "1600 Pennsylvania Avenue, Washington",
  "4 Privet Drive, Little Whinging",
  "742 Evergreen Terrace, Springfield",
  "Piazza del Duomo 1, Milano",
  "31 Spooner Street, Quahog",
  "Apartment 5A, 129 West 81st Street, New York",
  "12 Grimmauld Place, London",
  "House 9, Sesame Street",
];

/** Plain Levenshtein. Small strings, no need for anything cleverer. */
function distance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const row = [i, ...Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = row;
  }
  return prev[n]!;
}

/**
 * An address autocomplete whose suggestions are ranked by edit distance
 * *descending*. The more you type, the worse they get.
 *
 * At zero characters the correct address is first. The honest solve is to
 * click the field, type nothing, and take the top suggestion — which takes
 * most people about thirty-five seconds to consider, because every instinct
 * they have says type.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CANDIDATES.slice(0, 5);
    /* Descending. Deliberately, catastrophically, backwards. */
    return [...CANDIDATES]
      .sort((a, b) => distance(b.toLowerCase(), q) - distance(a.toLowerCase(), q))
      .slice(0, 5);
  }, [query]);

  const pick = (address: string) => {
    setChosen(address);
    setQuery(address);
    setOpen(false);
    sfx.click();
    if (address === CORRECT) {
      onSolve();
      return;
    }
    setError(`We couldn't verify that address. Showing results for: ${address.split(",").pop()?.trim()}.`);
    onFail("wrong-address");
    sfx.fail();
  };

  return (
    <SlopCard>
      <SlopBadge>Delivery · SOC2 (pending)</SlopBadge>
      <SlopHeading>Confirm Your Address 📦</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.target}>
        Deliver to: <b>{CORRECT}</b>
      </div>

      <input
        className={s.input}
        value={query}
        placeholder="Start typing your address…"
        aria-label="Address"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setChosen(null);
          setOpen(true);
        }}
      />

      {open && (
        <div className={s.list} role="listbox">
          {suggestions.length === 0 ? (
            <div className={s.empty}>No matches.</div>
          ) : (
            suggestions.map((a) => (
              <button
                key={a}
                type="button"
                role="option"
                aria-selected={chosen === a}
                className={s.option}
                onClick={() => pick(a)}
              >
                {a}
              </button>
            ))
          )}
        </div>
      )}

      <SlopError>{error}</SlopError>
      <SlopHint>
        Our AI-powered address matcher gets smarter the more you type. ✨
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L27: LevelModule = { meta, Component };
