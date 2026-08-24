"use client";

import { useState } from "react";
import s from "./handle.module.css";

/**
 * An X handle, with their picture, linking to their profile.
 *
 * The avatar comes from unavatar.io, which resolves a public profile image
 * from a handle without any API key or OAuth. Handles here are typed, not
 * verified, so this can resolve to the wrong person's face or to nothing at
 * all — hence the initial-letter fallback, which is what most rows will show
 * and needs to look deliberate rather than broken.
 */
export function Handle({
  handle,
  size = 26,
  link = true,
}: {
  handle: string;
  size?: number;
  link?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const clean = handle.replace(/^@+/, "");
  const initial = clean.slice(0, 1).toUpperCase() || "?";

  const avatar = failed ? (
    <span className={s.fallback} style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {initial}
    </span>
  ) : (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      className={s.avatar}
      style={{ width: size, height: size }}
      src={`https://unavatar.io/x/${encodeURIComponent(clean)}?fallback=false`}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );

  const body = (
    <>
      {avatar}
      <span className={s.name}>@{clean}</span>
    </>
  );

  if (!link) return <span className={s.wrap}>{body}</span>;

  return (
    <a
      className={`${s.wrap} ${s.link}`}
      href={`https://x.com/${encodeURIComponent(clean)}`}
      target="_blank"
      rel="noreferrer noopener"
    >
      {body}
    </a>
  );
}
