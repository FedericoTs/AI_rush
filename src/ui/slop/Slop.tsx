"use client";

import type { ReactNode } from "react";
import styles from "./slop.module.css";

/**
 * The slop design system.
 *
 * Not ad-hoc per level: consistency is what sells the premise that one thing
 * generated all of this. The joke is never "this is ugly" — it is "this is
 * expensive-looking and completely deranged." Everything here should read as
 * though it shipped, with a design review, at a company with a Series B.
 */

export function SlopCard({ children, plain = false }: { children: ReactNode; plain?: boolean }) {
  return <div className={plain ? `${styles.card} ${styles.plain}` : styles.card}>{children}</div>;
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

  return (
    <h2 className={styles.heading}>
      {match[1]}
      <span className={styles.headingEmoji}>{match[2]}</span>
    </h2>
  );
}

export function SlopMicrocopy({ children }: { children: ReactNode }) {
  return <p className={styles.sub}>{children}</p>;
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
    <button className={styles.cta} onClick={onClick} disabled={disabled} type="button">
      {children}
    </button>
  );
}

export function SlopFooter({ links }: { links: readonly string[] }) {
  return (
    <div className={styles.foot}>
      {links.map((l, i) => (
        <span key={`${l}-${i}`}>{l}</span>
      ))}
    </div>
  );
}

export { styles as slop };
