"use client";

import type { ReactNode } from "react";
import { findSecret } from "@/lib/unlockStore";
import styles from "./slop.module.css";

/**
 * The slop design system.
 *
 * Not ad-hoc per level: consistency is what sells the premise that one thing
 * generated all of this. The joke is never "this is ugly" — it is "this is
 * expensive-looking and completely deranged." Everything here should read as
 * though it shipped, with a design review, at a company with a Series B.
 */

/*
 * The data attributes below are how `ChaosProvider` finds things.
 *
 * A modifier composes over *any* level and no level implements one, so the
 * wrapper has to locate the card, the primary button and the microcopy from the
 * outside — and it cannot do that through CSS-module class names, which are
 * hashed at build time. These are the stable handles. They are on the shared
 * chrome rather than in `src/levels/**`, which is what keeps the sandbox rule
 * intact: not one level knows a modifier exists.
 */
export function SlopCard({ children, plain = false }: { children: ReactNode; plain?: boolean }) {
  return (
    <div className={plain ? `${styles.card} ${styles.plain}` : styles.card} data-slop-card>
      {children}
    </div>
  );
}

export function SlopBadge({ children }: { children: ReactNode }) {
  return <div className={styles.badge}>{children}</div>;
}

/**
 * A gradient heading, with the emoji left out of the gradient.
 *
 * `background-clip: text` paints the text with the gradient by making the
 * glyphs transparent — and it does that to the emoji too, so every heading in
 * the game was rendering its 🍪 or 🎨 as a featureless violet rectangle. That
 * reads as a rendering bug rather than as a design choice, which is the one
 * thing the slop is not allowed to look like: it has to look expensive and
 * deranged, never broken.
 *
 * Headings put their emoji at the end, so splitting the trailing run of
 * non-word characters off and painting it normally fixes all of them at once
 * without touching a single call site.
 */
export function SlopHeading({ children }: { children: ReactNode }) {
  if (typeof children !== "string") {
    return <h2 className={styles.heading}>{children}</h2>;
  }

  const match = /^(.*?)(\s*[^\p{L}\p{N}\p{P}\s]+)$/u.exec(children);
  if (!match) return <h2 className={styles.heading}>{children}</h2>;

  /*
   * Both halves in a span, including the words.
   *
   * The `Mirror` modifier counter-flips leaf elements — an element whose text
   * is its own — so that a mirrored layout still reads. An `<h2>` holding bare
   * text *and* the emoji span is not a leaf, and the heading came out backwards
   * on every card. Wrapping the words makes both halves leaves and costs
   * nothing here: the gradient is inherited through `background-clip: text` on
   * the parent either way.
   */
  return (
    <h2 className={styles.heading}>
      <span className={styles.headingText}>{match[1]}</span>
      <span className={styles.headingEmoji}>{match[2]}</span>
    </h2>
  );
}

export function SlopMicrocopy({ children }: { children: ReactNode }) {
  return <p className={styles.sub} data-slop-microcopy>{children}</p>;
}

export function SlopHint({ children }: { children: ReactNode }) {
  return <p className={styles.hint}>{children}</p>;
}

export function SlopError({ children }: { children: ReactNode }) {
  return children ? <div className={styles.err}>{children}</div> : null;
}

export function SlopCta({
  children, onClick, disabled,
}: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button className={styles.cta} onClick={onClick} disabled={disabled} type="button" data-slop-cta>
      {children}
    </button>
  );
}

/**
 * The dead footer links every one of these interfaces has.
 *
 * Except that the list has always ended `… Careers, Careers` — a duplicate
 * that has been sitting in the phrase bank since the first level shipped,
 * reading as exactly the kind of mistake the thing generating these pages
 * would make.
 *
 * The second one is real. Clicking it opens the level that is not in the
 * catalogue, and nothing anywhere announces that. It is the one secret in the
 * game, it has been on screen the whole time, and it goes to the player who
 * reads the slop instead of skipping it — which is the habit L10 exists to
 * teach and the thing this game most wants to reward.
 *
 * Deliberately not a keyboard trap: it is a real button with a real focus
 * ring, so tabbing to the end of a level finds it too.
 */
export function SlopFooter({ links }: { links: readonly string[] }) {
  const seen = new Set<string>();

  return (
    <div className={styles.foot}>
      {links.map((label, i) => {
        const duplicate = seen.has(label);
        seen.add(label);
        if (!duplicate) return <span key={`${label}-${i}`}>{label}</span>;

        return (
          <button
            key={`${label}-${i}`}
            type="button"
            className={styles.secretLink}
            data-secret="careers"
            onClick={() => {
              if (findSecret()) window.dispatchEvent(new CustomEvent(SECRET_FOUND));
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Fired once, the first time anybody clicks the duplicate. */
export const SECRET_FOUND = "ai-rush:secret-found";

export { styles as slop };
