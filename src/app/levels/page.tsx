import Link from "next/link";
import { TIER_BASE } from "@/engine/scoring";
import type { InputCapability, LevelMeta, Tier } from "@/engine/types";
import { CATALOG } from "@/levels/catalog";
import { LockedRow } from "./LockedRow";
import { Logo } from "@/ui/logo/Logo";
import s from "./levels.module.css";

export const metadata = {
  title: "Every level",
  description: "Every interface in AI RUSH, and a practice room to take any of them apart.",
};

const TIERS: ReadonlyArray<{ id: Tier; label: string }> = [
  { id: "annoying", label: "Annoying" },
  { id: "cursed", label: "Cursed" },
  { id: "unhinged", label: "Unhinged" },
  { id: "forbidden", label: "Forbidden" },
];

/** Only the ones worth warning about. Pointer and keyboard are not news. */
const NOTABLE: Partial<Record<InputCapability, string>> = {
  motion: "tilt",
  orientation: "tilt",
  audioIn: "mic",
  camera: "camera",
  multitouch: "two fingers",
};

function needs(meta: LevelMeta): string[] {
  return [...new Set(meta.requires.map((r) => NOTABLE[r]).filter((x): x is string => !!x))];
}

/**
 * Every level, listed.
 *
 * A run deals you fourteen of these in an order you do not choose, which is
 * correct for a run and useless for anyone who wants another go at the one
 * that beat them. This is the other door: pick a level, play it alone, with a
 * clock that counts up instead of down and nothing filed anywhere.
 *
 * What each row shows is deliberately only what the interface *pretends* to
 * be. The whole game is the second and a half before you realise, and a level
 * index that gave away the mechanic would sell that for nothing.
 */
export default function Levels() {
  return (
    <main className={s.shell}>
      <div className={s.head}>
        <Logo size={22} />
        <h1>
          AI <i>RUSH</i>
        </h1>
        <div className={s.sp} />
        <Link className={s.back} href="/">
          Home
        </Link>
      </div>

      <p className={s.lede}>
        <b>{CATALOG.length} interfaces</b>, all of them shipped. A run deals you a random fourteen
        against a five-minute clock; in here you pick, the clock counts <b>up</b>, and nothing you
        do reaches the leaderboard. A few are locked — those are earned, or found.
      </p>

      <div className={s.allRow}>
        <Link className={s.playAll} href="/levels/all">
          Play everything you have opened
        </Link>
        <Link className={s.realRun} href="/play">
          Or take the real five minutes →
        </Link>
      </div>

      {TIERS.map((tier) => {
        const rows = CATALOG.filter((m) => m.tier === tier.id);
        if (rows.length === 0) return null;

        return (
          <section className={s.tier} key={tier.id}>
            <h2 className={s.tierHead}>
              <span className={s.tierName}>{tier.label}</span>
              <span className={s.tierWorth}>{TIER_BASE[tier.id].toLocaleString()} base</span>
            </h2>
            <div className={s.list}>
              {rows.map((m) => (
                <LockedRow meta={m} key={m.id}>
                  <span className={s.id}>{m.id}</span>
                  <span className={s.body}>
                    <span className={s.title}>{m.title}</span>
                    <span className={s.parodies}>
                      {m.parodies}
                      {/* The index credit. A contributor should be able to
                          send someone a link to the list and point at a row. */}
                      {m.creator && <i className={s.creator}> · by {m.creator.handle}</i>}
                    </span>
                  </span>
                  <span className={s.facts}>
                    {needs(m).map((n) => (
                      <span className={s.needs} key={n}>
                        {n}
                      </span>
                    ))}
                    <span className={s.par}>par {m.parSeconds}s</span>
                    <span className={s.go}>{m.unlock ? "locked" : "play →"}</span>
                  </span>
                </LockedRow>
              ))}
            </div>
          </section>
        );
      })}

      <p className={s.fine}>
        Par is what a level is scored against in a real run, not a time limit. Practice runs are
        never submitted — a board you could farm one level at a time would not be worth being on.
      </p>
      <p className={s.fine}>
        A locked level is worth exactly what its tier is worth. Opening one gets you something new
        to play, never an edge — the leaderboard cannot tell whether your run contained one, and
        that is on purpose.
      </p>

      <Link className={s.labLink} href="/lab">
        You think you can do worse? Design a level →
      </Link>
    </main>
  );
}
