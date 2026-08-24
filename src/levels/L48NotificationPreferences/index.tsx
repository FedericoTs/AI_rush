"use client";

import { useRef, useState } from "react";
import type { LevelModule, LevelProps } from "@/engine/types";
import { meta } from "./meta";
import { SlopBadge, SlopCard, SlopCta, SlopFooter, SlopHeading, SlopHint, SlopMicrocopy } from "@/ui/slop/Slop";
import { FOOTER_LINKS, slopSubhead } from "@/ui/slop/phrases";
import s from "./styles.module.css";

const SECTIONS = [
  { id: "email", name: "Email", toggle: "Weekly digest" },
  { id: "push", name: "Push", toggle: "Mentions only" },
  { id: "sms", name: "SMS", toggle: "Security alerts" },
  { id: "desktop", name: "Desktop", toggle: "Quiet hours" },
  { id: "calendar", name: "Calendar", toggle: "Invite reminders" },
  { id: "digest", name: "Product news", toggle: "Feature announcements" },
] as const;

/** The three that have to be switched on. Spread out, so the order matters. */
const REQUIRED = ["push", "desktop", "digest"] as const;

/**
 * Pure layout cruelty.
 *
 * Six collapsible sections; opening one collapses its siblings. Because the
 * page height changes as they collapse, the section you just opened scrolls
 * out of view — and everyone chases it back up the page.
 *
 * The honest solve is to open them **bottom to top**. Collapsing a section
 * *above* your target pulls content up and takes the target with it; collapsing
 * one *below* does not move it at all. Order makes this trivial. Everyone
 * starts at the top.
 *
 * There is no coupling graph here on purpose. The family's engine models
 * numbers moving other numbers, and this moves *pixels* — putting a scroll
 * offset into a graph of control values would be a category error dressed up as
 * consistency. `ARCHITECTURE.md`'s `relayout` edge stays unimplemented for
 * exactly that reason.
 */
function Component({ onSolve, rng, sfx }: LevelProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [sub] = useState(() => slopSubhead(rng));
  const scroller = useRef<HTMLDivElement | null>(null);

  const toggleSection = (id: string) => {
    const before = scroller.current?.scrollTop ?? 0;
    setOpen((cur) => (cur === id ? null : id));
    sfx.click();
    /* The layout shift, made real rather than simulated: the panel keeps its
       scroll offset while the content above it changes height, so the section
       you just opened genuinely moves. Nothing here scrolls anything *to* you. */
    requestAnimationFrame(() => {
      if (scroller.current) scroller.current.scrollTop = before;
    });
  };

  const done = REQUIRED.every((id) => on[id]);

  return (
    <SlopCard>
      <SlopBadge>Notifications · Trusted by Teams</SlopBadge>
      <SlopHeading>Notification Preferences 🔔</SlopHeading>
      <SlopMicrocopy>{sub}</SlopMicrocopy>

      <p className={s.ask}>
        Turn on: {REQUIRED.map((id) => SECTIONS.find((x) => x.id === id)!.name).join(", ")}.
      </p>

      <div className={s.panel} ref={scroller} data-testid="accordion">
        {SECTIONS.map((sec) => {
          const isOpen = open === sec.id;
          return (
            <div className={s.section} key={sec.id}>
              <button
                type="button"
                className={s.header}
                onClick={() => toggleSection(sec.id)}
                aria-expanded={isOpen}
                data-testid={`section-${sec.id}`}
              >
                <span>{sec.name}</span>
                <i className={s.chev}>{isOpen ? "▾" : "▸"}</i>
                {on[sec.id] && <em className={s.dot} aria-label="on" />}
              </button>

              {isOpen && (
                <div className={s.body}>
                  <p className={s.blurb}>
                    Choose how and when {sec.name.toLowerCase()} notifications reach you. We use
                    AI-powered relevance scoring to keep things useful. ✨
                  </p>
                  <label className={s.switch}>
                    <input
                      type="checkbox"
                      checked={!!on[sec.id]}
                      data-testid={`toggle-${sec.id}`}
                      onChange={(e) => setOn((o) => ({ ...o, [sec.id]: e.target.checked }))}
                    />
                    <span>{sec.toggle}</span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <SlopCta onClick={() => done && onSolve()} disabled={!done}>
        {done ? "Save Preferences" : `${REQUIRED.filter((id) => on[id]).length} of 3 enabled`}
      </SlopCta>
      <SlopHint>
        Only one section can be expanded at a time, to keep this page tidy. 🧹
      </SlopHint>
      <SlopFooter links={FOOTER_LINKS} />
    </SlopCard>
  );
}

export const L48: LevelModule = { meta, Component };
