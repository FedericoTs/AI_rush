#!/usr/bin/env node
/**
 * Turn a folder of playtest sessions into the two decisions Phase 2 owes.
 *
 *   npm run playtest:report -- ./playtests
 *
 * The protocol in `docs/PLAYTEST.md` ends with "rebalance par times from the
 * recordings", which in practice means somebody scrubbing five videos with a
 * notepad. The observer bar already recorded the timings against the run's own
 * clock, so this reads them instead.
 *
 * It answers exactly two questions and refuses to editorialise beyond them:
 *
 *   1. **Did it land?** Laughs per session, and whether the gate is met.
 *   2. **Which levels are wrong, and how?** Confused silence, skip rate, and a
 *      proposed par drawn from what people actually did.
 *
 * Deliberately plain Node with no dependencies: it runs from a checkout on
 * someone's laptop the evening of the playtest, which is the only time anyone
 * will ever want it.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/* `ROADMAP.md` Phase 2: "laughs out loud at least twice". Per person. */
const LAUGH_GATE = 2;

/* `ROADMAP.md` Phase 8: cut or fix anything past these. Applied here as well
   as there, because a level this broken should not survive to Phase 8. */
const SKIP_RATE_CUT = 0.6;
const FREE_POINTS_MS = 5_000;

const PAD = (s, n) => String(s).padEnd(n);
const LPAD = (s, n) => String(s).padStart(n);

function median(xs) {
  if (xs.length === 0) return null;
  const a = [...xs].sort((p, q) => p - q);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

async function loadSessions(dir) {
  const names = (await readdir(dir)).filter((n) => n.endsWith(".json"));
  const out = [];
  for (const name of names) {
    try {
      const parsed = JSON.parse(await readFile(join(dir, name), "utf8"));
      if (parsed.version !== 1 || !Array.isArray(parsed.events)) {
        console.warn(`  ! ${name}: not a playtest session, skipping`);
        continue;
      }
      out.push({ name, ...parsed });
    } catch (err) {
      console.warn(`  ! ${name}: ${err.message}`);
    }
  }
  return out;
}

/**
 * Fold every session into one row per level.
 *
 * A mark is attributed to whatever was on screen when it was pressed, which is
 * the honest attribution — the facilitator was watching a person react to a
 * thing, and the thing was on screen.
 */
function perLevel(sessions) {
  const rows = new Map();
  const row = (id) => {
    if (!rows.has(id)) {
      rows.set(id, {
        id, title: id, tier: "?", par: null,
        dealt: 0, solved: 0, skipped: 0, fails: 0,
        solveTimes: [], firstTrySolveTimes: [],
        laugh: 0, confused: 0, rage: 0, note: 0,
      });
    }
    return rows.get(id);
  };

  for (const s of sessions) {
    for (const meta of s.levels ?? []) {
      const r = row(meta.id);
      r.title = meta.title;
      r.tier = meta.tier;
      r.par = meta.parSeconds;
    }
    /* `dealt` counts levels the player actually reached, not levels in the
       deck: a five-minute run rarely gets through all fourteen, and counting
       the unseen ones as skips would make every deck look unreadable. */
    for (const e of s.events) {
      const r = row(e.levelId);
      if (e.kind === "enter") r.dealt++;
      if (e.kind === "fail") r.fails++;
      if (e.kind === "skip") r.skipped++;
      if (e.kind === "solve") {
        r.solved++;
        if (typeof e.solveMs === "number") r.solveTimes.push(e.solveMs);
      }
    }
    for (const b of s.breakdown ?? []) {
      if (!b.skipped && b.fails === 0) row(b.id).firstTrySolveTimes.push(b.solveMs);
    }
    for (const m of s.marks ?? []) {
      const r = rows.get(m.levelId);
      if (r) r[m.kind]++;
    }
  }
  return [...rows.values()];
}

/**
 * What par should be.
 *
 * Par is meant to be "a competent player, first try, not rushing" — so the
 * median of clean first-try solves is the measurement, not the median of all
 * solves (which is dragged up by people who failed twice first). Rounded up to
 * the second, because par is quoted in seconds and rounding down invents
 * pressure nobody measured.
 *
 * Fewer than three clean solves is not a sample, and this says so rather than
 * proposing a number off one person's lucky run.
 */
function proposedPar(row) {
  if (row.firstTrySolveTimes.length < 3) return null;
  return Math.max(3, Math.ceil(median(row.firstTrySolveTimes) / 1000));
}

function verdict(row) {
  const seen = row.dealt;
  if (seen === 0) return { flag: "", note: "not reached" };

  const skipRate = row.skipped / seen;
  const med = median(row.solveTimes);

  /* The roadmap says "cut or fix", and the two are not the same verdict. A
     level nobody engages with and nobody enjoys is dead weight. A level nobody
     can finish but everybody laughs at has a good joke and a bad mechanic —
     which is a rewrite, and throwing it away would be the expensive mistake. */
  if (skipRate > SKIP_RATE_CUT) {
    const why = `${Math.round(skipRate * 100)}% skipped`;
    return row.laugh >= 2
      ? { flag: "FIX", note: `${why}, but ${row.laugh} laughs — the joke lands, the mechanic doesn't` }
      : { flag: "CUT?", note: `${why}, ${row.laugh} laughs — unreadable` };
  }
  if (row.confused >= 2 && row.laugh === 0) {
    return { flag: "CUT?", note: `${row.confused} confused, 0 laughs — the failure mode` };
  }
  if (med !== null && med < FREE_POINTS_MS && row.solved >= 3) {
    return { flag: "FREE", note: `${(med / 1000).toFixed(1)}s median — free points` };
  }
  if (row.confused > row.laugh && row.confused >= 2) {
    return { flag: "WATCH", note: `confusion (${row.confused}) beats laughs (${row.laugh})` };
  }
  if (row.laugh >= 2) return { flag: "KEEP", note: `${row.laugh} laughs` };
  return { flag: "", note: "" };
}

function report(sessions) {
  const rows = perLevel(sessions).filter((r) => r.dealt > 0);
  rows.sort((a, b) => b.laugh - a.laugh || b.confused - a.confused || a.id.localeCompare(b.id));

  const totalLaughs = sessions.reduce(
    (n, s) => n + (s.marks ?? []).filter((m) => m.kind === "laugh").length, 0,
  );
  const passing = sessions.filter(
    (s) => (s.marks ?? []).filter((m) => m.kind === "laugh").length >= LAUGH_GATE,
  ).length;

  console.log(`\n  AI RUSH · PLAYTEST REPORT`);
  console.log(`  ${sessions.length} session${sessions.length === 1 ? "" : "s"}, ${rows.length} levels reached\n`);

  console.log(`  ── the gate ──────────────────────────────────────────────`);
  console.log(`  Phase 2 exits when somebody who isn't us laughs out loud twice.\n`);
  for (const s of sessions) {
    const laughs = (s.marks ?? []).filter((m) => m.kind === "laugh").length;
    const confused = (s.marks ?? []).filter((m) => m.kind === "confused").length;
    const who = (s.subject || s.name).slice(0, 34);
    console.log(
      `  ${laughs >= LAUGH_GATE ? "✔" : "✘"} ${PAD(who, 36)} ` +
      `${LPAD(laughs, 2)} ${PAD(laughs === 1 ? "laugh" : "laughs", 7)}` +
      `${LPAD(confused, 2)} confused  ${LPAD(s.score.toLocaleString(), 7)} pts`,
    );
  }
  console.log(
    `\n  ${passing}/${sessions.length} sessions met the gate · ${totalLaughs} laughs total`,
  );
  console.log(
    passing === sessions.length && sessions.length >= 5
      ? `  → Phase 2 passes. Rebalance par below, then start Phase 3.\n`
      : `  → Not met. Fix the levels flagged below before building anything downstream.\n`,
  );

  console.log(`  ── the levels ────────────────────────────────────────────`);
  console.log(
    `  ${PAD("ID", 5)}${PAD("TITLE", 30)}${LPAD("SEEN", 5)}${LPAD("SKIP", 6)}` +
    `${LPAD("MED", 7)}${LPAD("PAR", 5)}${LPAD("→PAR", 6)}${LPAD("LOL", 5)}${LPAD("???", 5)}  FLAG`,
  );

  for (const r of rows) {
    const med = median(r.solveTimes);
    const par = proposedPar(r);
    const v = verdict(r);
    const shift = par !== null && r.par !== null && par !== r.par ? `${par}s` : par === null ? "—" : "=";
    console.log(
      `  ${PAD(r.id, 5)}${PAD(r.title.slice(0, 28), 30)}${LPAD(r.dealt, 5)}` +
      `${LPAD(`${Math.round((r.skipped / r.dealt) * 100)}%`, 6)}` +
      `${LPAD(med === null ? "—" : `${(med / 1000).toFixed(1)}s`, 7)}` +
      `${LPAD(`${r.par ?? "?"}s`, 5)}${LPAD(shift, 6)}` +
      `${LPAD(r.laugh, 5)}${LPAD(r.confused, 5)}  ${v.flag}`,
    );
  }

  const acts = rows.map((r) => ({ r, v: verdict(r) })).filter((x) => x.v.flag && x.v.flag !== "KEEP");
  if (acts.length > 0) {
    console.log(`\n  ── what to do ────────────────────────────────────────────`);
    for (const { r, v } of acts) console.log(`  ${PAD(v.flag, 6)}${PAD(r.id, 5)}${v.note}`);
  }

  const parChanges = rows
    .map((r) => ({ r, par: proposedPar(r) }))
    .filter((x) => x.par !== null && x.r.par !== null && Math.abs(x.par - x.r.par) >= 2);
  if (parChanges.length > 0) {
    console.log(`\n  ── par changes worth making (±2s or more) ────────────────`);
    for (const { r, par } of parChanges) {
      console.log(`  ${PAD(r.id, 5)}${LPAD(`${r.par}s`, 5)} → ${LPAD(`${par}s`, 4)}   ${r.title}`);
    }
    console.log(`\n  These are medians of clean first-try solves. Edit meta.parSeconds.`);
  }

  console.log();
  return acts.length;
}

const dir = process.argv[2] ?? "./playtests";
const sessions = await loadSessions(dir).catch((err) => {
  console.error(`\n  Cannot read ${dir}: ${err.message}`);
  console.error(`  Usage: npm run playtest:report -- ./path/to/sessions\n`);
  process.exit(1);
});

if (sessions.length === 0) {
  console.error(`\n  No sessions in ${dir}.`);
  console.error(`  Save them from the tally screen of a run opened with ?observe=1.\n`);
  process.exit(1);
}

report(sessions);
