import Link from "next/link";
import { boardTop, dbConfigured, liveStats } from "@/lib/db";
import { Handle } from "@/ui/Handle";
import { LiveDot } from "@/ui/LiveDot";
import s from "./board.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard" };

export default async function Board({
  searchParams,
}: {
  searchParams: Promise<{ mercy?: string }>;
}) {
  const { mercy } = await searchParams;
  const isMercy = mercy === "1";
  const [rows, stats] = await Promise.all([boardTop(isMercy, 50), liveStats()]);

  return (
    <main className={s.shell}>
      <div className={s.head}>
        <h1>
          AI <i>RUSH</i>
        </h1>
        <div className={s.sp} />
        <div className={s.tabs}>
          <Link href="/board" className={`${s.tab} ${isMercy ? "" : s.tabOn}`}>Open</Link>
          <Link href="/board?mercy=1" className={`${s.tab} ${isMercy ? s.tabOn : ""}`}>Mercy</Link>
        </div>
      </div>

      <LiveDot playingNow={stats.playingNow} runsToday={stats.runsToday} players={stats.players} />

      <p className={s.lede}>
        {isMercy
          ? "Mercy mode runs are filed separately, so the open board stays honest and nobody has to choose between playing and being okay."
          : "Best run per handle. Five minutes, however many interfaces you can survive."}
      </p>

      {rows.length === 0 ? (
        <div className={s.empty}>
          {dbConfigured
            ? "Nobody has survived yet. Be the first name on it."
            : "The leaderboard is not configured on this build."}
        </div>
      ) : (
        <div className={s.board}>
          {rows.map((r) => (
            <div key={`${r.handle}-${r.rank}`} className={`${s.row} ${r.rank <= 3 ? s.top : ""}`}>
              <span className={s.rank}>#{r.rank.toLocaleString()}</span>
              <span className={s.handle}>
                <Handle handle={r.handle} />
                {r.killed_by && <span className={s.death}>killed by &ldquo;{r.killed_by}&rdquo;</span>}
              </span>
              <span className={s.scoreCell}>
                <span className={s.score}>{r.score.toLocaleString()}</span>
                {/* Nothing to chase in a score of zero, so no invitation to try. */}
                {r.score > 0 && (
                  <Link
                    className={s.beat}
                    href={{ pathname: "/play", query: { seed: r.seed, vs: r.handle, target: r.score } }}
                  >
                    beat it
                  </Link>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <Link className={s.cta} href="/play">
        Take your five minutes
      </Link>
      <Link className={s.labLink} href="/lab">
        You think you can do worse? Design a level →
      </Link>
    </main>
  );
}
