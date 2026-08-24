import Link from "next/link";
import { selectBoard, dbConfigured } from "@/lib/db";
import s from "./board.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Rush · Leaderboard" };

export default async function Board({
  searchParams,
}: {
  searchParams: Promise<{ mercy?: string }>;
}) {
  const { mercy } = await searchParams;
  const isMercy = mercy === "1";
  const rows = await selectBoard(isMercy, 50);

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
          {rows.map((r, i) => (
            <div key={`${r.handle}-${i}`} className={`${s.row} ${i < 3 ? s.top : ""}`}>
              <span className={s.rank}>#{(i + 1).toLocaleString()}</span>
              <span className={s.handle}>
                {r.handle}
                {r.killed_by && <span className={s.death}>killed by &ldquo;{r.killed_by}&rdquo;</span>}
              </span>
              <span className={s.score}>{r.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <Link className={s.cta} href="/play">
        Take your five minutes
      </Link>
    </main>
  );
}
