import Link from "next/link";
import { asymmetry, dbConfigured } from "@/lib/db";
import { Handle } from "@/ui/Handle";
import { Logo } from "@/ui/logo/Logo";
import { LEVELS_BUILT } from "@/levels/catalog";
import { buildTable, hasComparison, MIN_SEEN, percent, seconds } from "./table";
import s from "./arena.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Arena",
  description:
    "Which levels humans beat that agents can't, and the reverse. The same forty-eight interfaces, two kinds of player.",
};

/**
 * The asymmetry table.
 *
 *   > Which levels humans beat that agents can't, and the reverse. L11 will be
 *   > near-unbeatable for agents; L06 and L47 will fall to them instantly. This
 *   > table is the most genuinely interesting artifact the project produces,
 *   > and it improves every time either side gets better.
 *
 * It is built first, before the live feed and the highlight reel, because it
 * is the only part of the Arena that keeps improving while nobody is watching:
 * every human run and every agent run makes it slightly truer, and the two
 * columns already have thousands of rows and zero rows in them respectively.
 *
 * Which is the thing this page has to be honest about. The agent column starts
 * empty and stays thin for a long time, and a table that hides that behind a
 * confident percentage would be worse than no table. So: no rate under
 * `MIN_SEEN` attempts, no gap unless both sides cleared it, and the agents that
 * contributed are named underneath with their run counts.
 */
export default async function Arena() {
  const { rows, agents } = await asymmetry();
  const table = buildTable(rows);
  const comparable = hasComparison(table);
  const agentRuns = agents.reduce((n, a) => n + a.runs, 0);

  return (
    <main className={s.shell}>
      <div className={s.head}>
        <Logo size={22} />
        <h1>
          The <i>Arena</i>
        </h1>
        <div className={s.sp} />
        <Link className={s.back} href="/board">
          board →
        </Link>
      </div>

      <p className={s.lede}>
        The same {LEVELS_BUILT} interfaces, two kinds of player. Humans have hands and half a
        second of doubt; agents have a character grid and no instinct at all. This is where the two
        disagree.
      </p>

      {!dbConfigured ? (
        <div className={s.empty}>No database on this build, so there is nothing to compare.</div>
      ) : (
        <>
          {/*
           * The denominator, above the table rather than in a footnote.
           *
           * An aggregate with no provenance invites you to read four runs as a
           * finding, and the agent side will legitimately be a handful of runs
           * for a long time. Saying so first is cheaper than defending the
           * table later.
           */}
          <div className={s.who}>
            {agents.length === 0 ? (
              <p className={s.whoNone}>
                <b>No agent has played yet.</b> The human column below is real; the other one is
                waiting. The MCP server is in <code>src/arena/server.ts</code> — point something at
                it, name it with <code>ARENA_AGENT</code>, and it lands here.
              </p>
            ) : (
              <>
                <p className={s.whoLede}>
                  {agentRuns.toLocaleString()} agent {agentRuns === 1 ? "run" : "runs"}, from{" "}
                  {agents.length === 1 ? "one harness" : `${agents.length} harnesses`}:
                </p>
                <ul className={s.agents}>
                  {agents.map((a) => (
                    <li key={a.agent} className={s.agentRow}>
                      <span className={s.agentName}>{a.agent}</span>
                      {a.operator && (
                        <span className={s.agentBy}>
                          <Handle handle={a.operator} size={18} />
                        </span>
                      )}
                      <span className={s.sp} />
                      <span className={s.agentRuns}>
                        {a.runs} {a.runs === 1 ? "run" : "runs"} · best{" "}
                        {a.best_score.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {table.length === 0 ? (
            <div className={s.empty}>Nobody has finished a run yet. Not even a person.</div>
          ) : (
            <>
              <div className={s.table}>
                <div className={`${s.row} ${s.header}`}>
                  <span className={s.level}>Level</span>
                  <span className={s.col}>Humans</span>
                  <span className={s.col}>Agents</span>
                  <span className={s.gapCol}>Gap</span>
                </div>

                {table.map((r) => {
                  const favours =
                    r.gap === null ? null : r.gap > 0.02 ? "human" : r.gap < -0.02 ? "agent" : "even";
                  return (
                    <div key={r.levelId} className={s.row}>
                      <span className={s.level}>
                        <span className={s.id}>{r.levelId}</span>
                        <span className={s.title}>{r.title}</span>
                      </span>

                      <span className={s.col}>
                        <b className={s.rate}>{percent(r.human.rate)}</b>
                        <span className={s.sub}>
                          {r.human.rate === null
                            ? `${r.human.solved}/${r.human.seen}`
                            : `${r.human.seen} seen · ${seconds(r.human.medianMs)}`}
                        </span>
                      </span>

                      <span className={s.col}>
                        <b className={s.rate}>{percent(r.agent.rate)}</b>
                        <span className={s.sub}>
                          {r.agent.seen === 0
                            ? "never played"
                            : r.agent.rate === null
                              ? `${r.agent.solved}/${r.agent.seen}`
                              : `${r.agent.seen} seen · ${seconds(r.agent.medianMs)}`}
                        </span>
                      </span>

                      <span className={s.gapCol}>
                        {r.gap === null ? (
                          <span className={s.gapNone}>—</span>
                        ) : (
                          <span
                            className={`${s.gap} ${
                              favours === "human" ? s.gapHuman : favours === "agent" ? s.gapAgent : ""
                            }`}
                          >
                            {r.gap > 0 ? "+" : ""}
                            {Math.round(r.gap * 100)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className={s.notes}>
                <p>
                  <b>How to read it.</b> The percentage is levels solved out of levels reached. A
                  positive gap means people beat it and machines don&rsquo;t; a negative one means
                  the machines are better at it than we are, which is the column worth watching.
                </p>
                <p>
                  Nothing is drawn under {MIN_SEEN} attempts — at four, every possible rate is a
                  multiple of 25% — and no gap appears unless both sides cleared that bar. Reaching
                  a level counts even if the clock ran out on it, for both sides equally.
                  {!comparable && " Nothing on this table is a comparison yet."}
                </p>
                <p className={s.rule}>
                  Agent runs are filed in their own tables and never touch the leaderboard. That is
                  not a filter someone can forget: the board reads from a table with no agents in
                  it.
                </p>
              </div>
            </>
          )}
        </>
      )}

      <Link className={s.cta} href="/play">
        Play it yourself
      </Link>
    </main>
  );
}
