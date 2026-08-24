"use client";

import { useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const CAPACITY = 4;
const WANTED = ["Hiking", "Ceramics", "Jazz", "Sourdough"] as const;
const SQUATTERS = ["Synergy", "Blockchain", "Growth", "Hustle"] as const;
const SUGGESTIONS = [...WANTED, "Cycling", "Podcasts", "Pottery", "Bouldering"] as const;

/**
 * A field that is already full, and evicts least-recently-added.
 *
 * Four slots, four wrong tags in them. Every tag you add throws out whichever
 * tag has been there longest — which starts by removing the squatters and then,
 * if you take your time, starts removing your own.
 *
 * The honest solve is the pleasing part: because eviction is least-recently-
 * added, the last four tags added consecutively are exactly the four that
 * survive. So add all four correct tags in a row and the originals are gone by
 * the fourth. The trap is adding them one at a time while checking, which lets
 * the wrong ones cycle back around. Four decisive actions beat eight careful
 * ones — an unusual thing for this game to teach and worth teaching.
 *
 * The queue is the mechanic, so it lives here rather than in the coupling
 * graph: the graph models numbers moving each other, and this is a recency
 * order. The `evict` edge kind exists to say the relationship is there; the
 * level owns what "least recently" means.
 */
export function addTag(tags: readonly string[], tag: string): string[] {
  if (tags.includes(tag)) return [...tags];
  const next = [...tags, tag];
  /* Oldest out. The array *is* the recency order — index 0 is the eldest. */
  return next.length > CAPACITY ? next.slice(next.length - CAPACITY) : next;
}

function Component({ onSolve, rng, sfx }: LevelProps) {
  const [tags, setTags] = useState<string[]>(() => [...SQUATTERS]);
  const [draft, setDraft] = useState("");
  const [sub] = useState(() => slopSubhead(rng));

  const add = (tag: string) => {
    const clean = tag.trim();
    if (!clean) return;
    setTags((t) => addTag(t, clean));
    setDraft("");
    sfx.click();
  };

  const done = WANTED.every((w) => tags.includes(w));

  return (
    <SlopCard>
      <SlopBadge>Profile · AI-Powered</SlopBadge>
      <SlopHeading>Add Some Tags 🏷️</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <p className={s.ask}>
        Add these four interests to your profile:{" "}
        <b>{WANTED.join(", ")}</b>
      </p>

      <div className={s.field} data-testid="tag-field">
        {tags.map((t) => (
          <span
            key={t}
            className={`${s.chip} ${(WANTED as readonly string[]).includes(t) ? s.chipOk : ""}`}
            data-testid={`tag-${t}`}
          >
            {t}
          </span>
        ))}
        <input
          className={s.input}
          value={draft}
          placeholder={tags.length >= CAPACITY ? "Interests (4 of 4)" : "Add an interest…"}
          aria-label="Add an interest"
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
        />
      </div>

      <div className={s.suggestions}>
        {SUGGESTIONS.map((t) => (
          <button
            key={t}
            type="button"
            className={s.suggestion}
            onClick={() => add(t)}
            data-testid={`suggest-${t}`}
          >
            + {t}
          </button>
        ))}
      </div>

      <SlopCta onClick={() => done && onSolve()} disabled={!done}>
        {done ? "Save Interests" : `${tags.filter((t) => (WANTED as readonly string[]).includes(t)).length} of 4 interests added`}
      </SlopCta>
      <SlopHint>
        Your profile supports up to four interests. Older interests are retired automatically to
        keep your profile fresh. ♻️
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L45: LevelModule = { meta, Component };
