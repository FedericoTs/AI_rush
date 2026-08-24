"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopError, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

/**
 * Sorted by population, descending. No search field.
 *
 * This is the entire joke and it is a real thing that real products do when
 * somebody decides alphabetical is "not data-driven". The order is the bug.
 */
const COUNTRIES = [
  "India", "China", "United States", "Indonesia", "Pakistan", "Nigeria", "Brazil",
  "Bangladesh", "Russia", "Mexico", "Ethiopia", "Japan", "Philippines", "Egypt",
  "DR Congo", "Vietnam", "Iran", "Turkey", "Germany", "Thailand", "United Kingdom",
  "Tanzania", "France", "South Africa", "Italy", "Kenya", "Myanmar", "Colombia",
  "South Korea", "Sudan", "Uganda", "Spain", "Algeria", "Iraq", "Argentina",
  "Afghanistan", "Yemen", "Canada", "Poland", "Morocco", "Angola", "Ukraine",
  "Uzbekistan", "Malaysia", "Mozambique", "Ghana", "Peru", "Saudi Arabia",
  "Madagascar", "Côte d'Ivoire", "Nepal", "Cameroon", "Venezuela", "Niger",
  "Australia", "North Korea", "Syria", "Mali", "Burkina Faso", "Sri Lanka",
  "Malawi", "Zambia", "Kazakhstan", "Chad", "Chile", "Romania", "Somalia",
  "Senegal", "Guatemala", "Netherlands", "Ecuador", "Cambodia", "Zimbabwe",
  "Guinea", "Benin", "Rwanda", "Burundi", "Bolivia", "Tunisia", "Belgium",
  "Haiti", "Jordan", "Dominican Republic", "Cuba", "Sweden", "Czechia", "Greece",
  "Portugal", "Azerbaijan", "Hungary", "Belarus", "Israel", "Austria",
  "Switzerland", "Sierra Leone", "Togo", "Laos", "Paraguay", "Serbia", "Libya",
  "Bulgaria", "Lebanon", "Nicaragua", "Kyrgyzstan", "El Salvador", "Turkmenistan",
  "Singapore", "Denmark", "Finland", "Norway", "Ireland", "Croatia", "Georgia",
  "Uruguay", "Panama", "Jamaica", "Qatar", "Armenia", "Lithuania", "Albania",
  "Latvia", "Iceland", "Malta", "Andorra", "Monaco",
];

/** Fictional neighbours, inserted around the target when you get it wrong. */
const DECOYS = [
  "New Zealandia", "South Belgium", "Greater Iceland", "East Portugal",
  "Republic of Norwia", "Upper Chile", "Nordfinland", "Lower Austria",
  "Sao Tomé and Principality", "West Latvia",
];

const ITEM_HEIGHT = 34;
const SCROLL_MS = 1000;

/**
 * A country dropdown sorted by population, that will not hold still.
 *
 * The list creeps upward by one row a second whether or not you touch it, so
 * every scroll you make is immediately undone and the thing you were aiming at
 * is somewhere else by the time your finger arrives.
 *
 * The honest solve is a native listbox behaviour that this custom one
 * accidentally kept: typing a letter jumps to the first country starting with
 * it. Nothing says so. Everything about the control says it is a bespoke
 * component that would never do that, which is exactly why nobody tries.
 */
function Component({ onSolve, onFail, rng, sfx }: LevelProps) {
  const [list, setList] = useState<string[]>(() => COUNTRIES);
  const [target] = useState(() => rng.pick(COUNTRIES.slice(20)));
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sub] = useState(() => slopSubhead(rng));
  const boxRef = useRef<HTMLDivElement | null>(null);
  const typed = useRef<{ letter: string; index: number }>({ letter: "", index: -1 });

  /*
   * The creep. One row a second, upward, wrapping at the top.
   *
   * Not a transition — a hard jump, because a smooth one reads as a carousel
   * and a jump reads as the list actively refusing to stay where you put it.
   */
  useEffect(() => {
    const id = setInterval(() => {
      const box = boxRef.current;
      if (!box) return;
      const max = box.scrollHeight - box.clientHeight;
      box.scrollTop = box.scrollTop <= 0 ? max : Math.max(0, box.scrollTop - ITEM_HEIGHT);
    }, SCROLL_MS);
    return () => clearInterval(id);
  }, []);

  /** Type-ahead. Repeats of the same letter walk through the matches. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;
    const letter = e.key.toLowerCase();
    const matches = list
      .map((name, i) => ({ name, i }))
      .filter((m) => m.name.toLowerCase().startsWith(letter));
    if (matches.length === 0) return;

    e.preventDefault();
    const step = typed.current.letter === letter ? typed.current.index + 1 : 0;
    const hit = matches[step % matches.length]!;
    typed.current = { letter, index: step };

    setSelected(hit.name);
    sfx.blip();
    /* Land it in the middle: the creep will move it either way, and the middle
       buys the player the most seconds before it leaves. */
    const box = boxRef.current;
    if (box) box.scrollTop = Math.max(0, hit.i * ITEM_HEIGHT - box.clientHeight / 2);
  };

  const choose = (name: string) => {
    sfx.click();
    setSelected(name);
  };

  const confirm = () => {
    if (selected === target) {
      sfx.solve();
      onSolve();
      return;
    }
    sfx.fail();
    onFail("wrong-country");
    setError(`${selected ?? "Nothing"} is not where you are. Please try again! 🌍`);

    /* Wrong answers make the list worse: five countries that do not exist,
       inserted around the one you are looking for. */
    setList((prev) => {
      if (prev.length > COUNTRIES.length + 12) return prev;
      const at = prev.indexOf(target);
      if (at < 0) return prev;
      const fakes = rng.shuffle(DECOYS).slice(0, 5);
      const next = [...prev];
      next.splice(Math.max(0, at - 2), 0, ...fakes);
      return next;
    });
    setSelected(null);
  };

  return (
    <SlopCard>
      <SlopBadge>Localisation · AI-Powered</SlopBadge>
      <SlopHeading>Where are you based? 🌍</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <div className={s.field}>
        <span className={s.label}>Country or region</span>
        <div
          className={s.box}
          ref={boxRef}
          role="listbox"
          aria-label="Country or region"
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          {list.map((name, i) => (
            <button
              type="button"
              key={`${name}-${i}`}
              role="option"
              aria-selected={selected === name}
              className={`${s.option} ${selected === name ? s.optionOn : ""}`}
              onClick={() => choose(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <span className={s.meta}>
          {list.length} regions · sorted by population for relevance
        </span>
      </div>

      <div className={s.target}>
        Selected: <b>{selected ?? "—"}</b>
        <span className={s.want}>We have you down as {target}.</span>
      </div>

      <button type="button" className={s.cta} onClick={confirm}>
        Confirm Region
      </button>

      <SlopError>{error}</SlopError>
      <SlopHint>
        Can&rsquo;t find yours? The list is ordered by population so the most likely matches
        appear first. There is no search — we found it wasn&rsquo;t being used. 📊
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L03: LevelModule = { meta, Component };
