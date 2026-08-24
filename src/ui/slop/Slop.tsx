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

export function SlopHeading({ children }: { children: ReactNode }) {
  return <h2 className={styles.heading}>{children}</h2>;
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
