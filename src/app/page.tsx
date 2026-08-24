import Link from "next/link";
import { CATALOG } from "@/levels/catalog";
import { SheetTile } from "./SheetTile";
import { SUBHEADS } from "@/ui/slop/phrases";
import { boardTop, liveStats } from "@/lib/db";
import { Handle } from "@/ui/Handle";
import { LiveDot } from "@/ui/LiveDot";
import s from "./page.module.css";

export const dynamic = "force-dynamic";

/** Written in `docs/LEVELS.md`, whether or not they are built yet. */
const LEVELS_WRITTEN = 48;
const UNBUILT = LEVELS_WRITTEN - CATALOG.length;

/**
 * Ghost tiles to square off the sheet.
 *
 * The grid is two columns narrow and four wide, so padding the catalogue up to
 * the next multiple of four leaves no ragged remainder at either size — and
 * self-corrects every time a level ships.
 */
const EMPTY_CELLS = (4 - (CATALOG.length % 4)) % 4;

/**
 * The front page.
 *
 * The one rule: this must not look like the thing it is making fun of. A
 * centred hero, a violet gradient, three feature pills and a lot of air is the
 * house style of every interface inside this game, and wearing it out here
 * would be the single joke the player is not in on.
 *
 * So the chrome is a workbench instead — graph paper, hard 1px rules, a
 * specimen sheet of what has been pinned so far, and an honest count of what
 * has not. The only thing on the page pretending to be a real product is the
 * dialog, and it is pretending on purpose: START is red, on the right, in the
 * destructive slot. That is the entire thesis, and it is the first thing your
 * hands get wrong.
 */
export default async function Home() {
  const [top, stats] = await Promise.all([boardTop(false, 5), liveStats()]);

  return (
    <main className={s.shell}>
      {/* Masthead. A byline and a build number, because a person made this. */}
      <div className={s.masthead}>
        <span className={s.mastLeft}>HOSTILE INTERFACE SPEEDRUN</span>
        <span className={s.mastSp} />
        <span className={s.mastRight}>
          {CATALOG.length}/{LEVELS_WRITTEN} BUILT
        </span>
      </div>

      <div className={s.screen}>
        <header className={s.hero}>
          <h1 className={s.title}>
            AI<i>RUSH</i>
          </h1>
          <span className={s.sticker} aria-hidden="true">
            5:00
          </span>
          <span className={s.stickerTwo} aria-hidden="true">
            no&nbsp;pause
          </span>
        </header>

        <p className={s.lede}>
          A stack of interfaces built by something that has seen a million forms and understood{" "}
          <strong>none of them</strong>. Every one is solvable. None of them are fair. Solve or
          skip — the clock does not stop either way.
        </p>

        <LiveDot playingNow={stats.playingNow} runsToday={stats.runsToday} players={stats.players} />

        {/*
          * A strip of the actual microcopy from inside the levels.
          *
          * Not decoration — it is the register the whole game is written in,
          * and reading two lines of it tells a stranger more about what they
          * are about to sit through than a paragraph of description would.
          */}
        <div className={s.tickerFrame} aria-hidden="true">
          <span className={s.tickerLabel}>SLOP</span>
          <div className={s.tickerTrack}>
            <div className={s.ticker}>
              {[0, 1].map((copy) => (
                <span className={s.tickerRun} key={copy}>
                  {SUBHEADS.map((phrase) => (
                    <span className={s.tick} key={phrase}>
                      {phrase}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* The thesis, in one dialog. Green Cancel on the left, red Continue on
            the right. The full-strength version of this bit is L01; this is the
            handshake. */}
        <div className={s.dialog}>
          <span className={s.specimenTag} aria-hidden="true">
            SPECIMEN 00
          </span>
          <h2>Ready to get started? ✨</h2>
          <p>We just need a moment to verify a few things. This should be quick!</p>
          <div className={s.row}>
            <Link className={s.ghost} href="/play?mercy=1">
              Mercy mode
            </Link>
            <Link className={s.danger} href="/play">
              ⚠ START
            </Link>
          </div>
          <div className={s.note}>
            <strong>Mercy mode</strong> removes every level that needs a microphone, camera or
            motion, disables the four punishing modifiers, and files scores to a separate board.
            No mockery, no catch — it is the one part of this that is sincere.
          </div>
        </div>

        {/*
          * The sheet.
          *
          * A run deals fourteen of these in an order nobody chooses, so the
          * front page is the only place the whole catalogue is visible at once.
          * Each tile is a specimen: id, tier colour, and the ordinary interface
          * it is wearing. What it actually does stays unspoiled — that second
          * and a half is the game.
          */}
        <section className={s.sheet}>
          <div className={s.sectionHead}>
            <span className={s.sectionName}>The sheet</span>
            <span className={s.sectionNote}>
              {CATALOG.length} pinned · {UNBUILT} to go
            </span>
          </div>

          <div className={s.tiles}>
            {CATALOG.map((m) => (
              <SheetTile meta={m} key={m.id} />
            ))}

            {/*
              * The empty cells at the end of the grid are the point.
              *
              * A sheet that ends flush reads as finished, and this one is very
              * much not — most of the catalogue is written and unbuilt. Filling
              * the gap with the jar turns a layout remainder into the honest
              * status of the project, and puts the ask exactly where the eye
              * has already stopped.
              */}
            {Array.from({ length: EMPTY_CELLS }, (_, i) => (
              <Link className={s.ghostTile} key={`jar-${i}`} href="/lab">
                <span className={s.tileId}>???</span>
                <span className={s.ghostTitle}>Still in the jar</span>
                <span className={s.tileParodies}>{UNBUILT} written, unbuilt →</span>
              </Link>
            ))}
          </div>

          <Link className={s.levelsLink} href="/levels">
            All {CATALOG.length} levels — play any of them, no clock →
          </Link>
        </section>

        {/*
          * The board is always here, empty or not.
          *
          * Hiding it while nobody has played is exactly backwards: an empty
          * leaderboard with your name obviously missing from the top of it is
          * a better invitation than no leaderboard at all, and it shows the
          * shape of what pressing START leads to.
          */}
        <section className={s.boardBlock}>
          <div className={s.sectionHead}>
            <span className={s.sectionName}>Survivors</span>
            <Link className={s.sectionLink} href="/board">
              full board →
            </Link>
          </div>

          <div className={s.mini}>
            {top.length > 0
              ? top.map((r) => (
                  <Link
                    key={`${r.handle}-${r.rank}`}
                    className={s.miniRow}
                    href={
                      r.score > 0
                        ? { pathname: "/play", query: { seed: r.seed, vs: r.handle, target: r.score } }
                        : { pathname: "/play", query: { seed: r.seed } }
                    }
                  >
                    <span className={s.miniRank}>#{r.rank}</span>
                    <Handle handle={r.handle} size={22} link={false} />
                    <span className={s.miniScore}>{r.score.toLocaleString()}</span>
                  </Link>
                ))
              : [1, 2, 3].map((rank) => (
                  <div className={`${s.miniRow} ${s.miniEmpty}`} key={rank} aria-hidden="true">
                    <span className={s.miniRank}>#{rank}</span>
                    <span className={s.miniWaiting}>
                      <span className={s.miniAvatar} />
                      <span className={s.miniDash} />
                    </span>
                    <span className={s.miniScore}>—</span>
                  </div>
                ))}
          </div>

          <p className={s.boardFoot}>
            {top.length > 0
              ? "Tap anyone to play their exact run and try to beat it."
              : "Nobody has survived yet. That top row has your name on it."}
          </p>
        </section>

        {/* The ask, with the honest number attached: most of the catalogue is
            written and unbuilt, so "yours could be next" is a fact, not a pitch. */}
        <Link className={s.labLink} href="/lab">
          <span className={s.labBig}>You think you can do worse?</span>
          <span className={s.labSmall}>
            {UNBUILT} levels are written and unbuilt. Send one of your own and it ships with your
            handle on it →
          </span>
        </Link>

        <footer className={s.foot}>
          <span>Contains flashing colour and sudden sound. Mute is in the bar, once a run starts.</span>
          <span>No account. No email. Nothing to install.</span>
        </footer>
      </div>
    </main>
  );
}
