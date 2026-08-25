#!/usr/bin/env -S npx tsx
import { chromium, type Browser, type Page } from "playwright";
import { rasterize, type Region } from "./raster";
import { extractBoxes } from "./extract";
import { prepareContext } from "./page";
import { GAME_URL, VIEWPORT } from "./arena";
import { COLS, ROWS } from "./raster";
import { ALL_LEVEL_IDS, META_BY_ID } from "@/levels/catalog";
import { INTERACTIVE, resolvePoint } from "./reach";
import { isUnplayable, reasonFor } from "./impossible";

/**
 * Every level, checked against the properties the perception layer keeps
 * breaking.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * Seven blind agent runs found nine real bugs. Every one of them was in this
 * directory — the translation from a rendered page to a 48×24 grid — and not
 * one was in a level. The levels kept turning out to work exactly as designed.
 *
 * But a five-minute run is a terrible instrument for inspecting forty-nine
 * levels. Seven of them, about thirty-five minutes of wall clock, reached
 * twelve. The rest have never been perceived by an agent at all, and the one
 * run that went somewhere new found a severe bug within a minute of arriving.
 *
 * So the runs are not the tool. This is: the same checks, over the whole
 * catalogue, in about forty seconds, every time. Six of the nine bugs would have
 * been caught here — the invisible canvas, the invisible dropdowns, the
 * unclickable off-by-one, the unclickable rotation, the dropped toggles and
 * the missing wheels — and unlike a run, it keeps catching them.
 *
 * ── Why the checks are shaped this way ───────────────────────────────────
 *
 * The temptation is to assert what the extractor produces, which proves
 * nothing: the extractor would simply be agreeing with itself. Every check
 * below compares the grid against **the live page**, and the question is
 * always the same one —
 *
 *   Can a person do something here that the agent has not been told about,
 *   or been told about wrongly?
 *
 * That framing is what makes these findings real rather than stylistic. An
 * unfixed one does not merely annoy an agent: it lands in the asymmetry table
 * as a level agents cannot beat, which is indistinguishable from a finding and
 * is the single most damaging thing this project could publish.
 */

/* The run chrome, which every level carries and none of them is about. A level
   whose only controls are these has nothing to play. */
const CHROME = ["✕", "🔊", "Careers", "SKIP THIS LEVEL", "PRACTICE"];

const isChrome = (r: Region) =>
  CHROME.some((c) => r.label.includes(c)) || r.kind === "heading";

/** Playable regions: the things a level is actually made of. */
const playable = (regions: Region[]) => regions.filter((r) => !isChrome(r));

interface Finding {
  level: string;
  check: string;
  detail: string;
}

/**
 * What a person could use on this screen.
 *
 * Runs in the page, and deliberately does **not** reuse the extractor's own
 * notion of a control — a check that asked the extractor whether it had found
 * everything the extractor finds would pass forever. This is an independent
 * list, built from what a browser itself treats as interactive plus what it
 * paints an interactive cursor over, filtered by the same "is it actually
 * on screen" hit test a player's eyes apply.
 */
function liveControls() {
  const view = { w: window.innerWidth, h: window.innerHeight };
  const out: Array<{
    cx: number; cy: number; label: string; cursor: string; tag: string;
  }> = [];

  const SELECTOR =
    "button, a, input, textarea, select, [role=button], [role=switch], [role=spinbutton], [role=slider]";
  const DRAGGY = ["ns-resize", "ew-resize", "row-resize", "col-resize", "grab", "grabbing", "move"];

  const seen = new Set<Element>();
  const consider = (el: Element) => {
    if (seen.has(el)) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    if (rect.bottom < 0 || rect.right < 0 || rect.top > view.h || rect.left > view.w) return;

    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return;
    if (Number(style.opacity) <= 0.05) return;
    if (style.pointerEvents === "none") return;

    const cx = Math.min(view.w - 1, Math.max(0, rect.left + rect.width / 2));
    const cy = Math.min(view.h - 1, Math.max(0, rect.top + rect.height / 2));
    /* Clipped or covered: a player cannot use it either, so the grid is right
       to withhold it. This is the same test the extractor applies, and it is
       the one place the two must agree — otherwise this check would report
       every scrolled-away row in L05's list of forty-seven. */
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(hit === el || el.contains(hit))) return;

    seen.add(el);
    for (const child of Array.from(el.querySelectorAll("*"))) seen.add(child);
    out.push({
      cx, cy,
      label: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30),
      cursor: style.cursor,
      tag: el.tagName.toLowerCase(),
    });
  };

  for (const el of Array.from(document.querySelectorAll(SELECTOR))) consider(el);
  /* Anything the browser paints a hand or a drag cursor over is a control to
     the person looking at it, whatever it is built from. */
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("div, span, i, li"))) {
    const c = getComputedStyle(el).cursor;
    if (c === "pointer" || DRAGGY.includes(c)) consider(el);
  }
  return out;
}

/** What is painted at a point, and whether it is a control. */
function probePoint([x, y]: [number, number]) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const control = el.closest<HTMLElement>(
    "button, a, input, textarea, select, [role=button], [role=switch], [role=spinbutton], [role=slider]",
  );
  /* Kept as a literal rather than imported: this is serialised into the page
     and has no module scope on the other side. */
  const style = getComputedStyle(control ?? el);
  /* The same set `reach.ts` treats as a control. Two lists that drift apart
     make this check report failures the harness does not have — which is how
     L34's grab-cursor drag nodes were flagged as unreachable when they are
     the level. */
  const c = style.cursor;
  return {
    interactive:
      Boolean(control) ||
      c === "pointer" || c.endsWith("-resize") || c === "grab" || c === "grabbing",
    cursor: style.cursor,
    label: ((control ?? el).textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30),
  };
}

const toPixels = (x: number, y: number) => ({
  px: Math.round((x + 0.5) * (VIEWPORT.width / COLS)),
  py: Math.round((y + 0.5) * (VIEWPORT.height / ROWS)),
});

/* The Rotate modifier, applied by hand. Two of the nine bugs only appeared
   under it, and it composes over every level, so every level is checked both
   ways. The numbers are lifted from `chaos.module.css`. */
const TILT = `[data-level]{rotate:15deg;transform:scale(.82);transform-origin:50% 40%}`;

async function checkLevel(page: Page, level: string, tilted: boolean): Promise<Finding[]> {
  const found: Finding[] = [];
  const where = tilted ? `${level} (tilted)` : level;

  await page.goto(new URL(`/play?level=${level}`, GAME_URL).toString(), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("[data-level]", { timeout: 20_000 }).catch(() => {});
  if (tilted) await page.addStyleTag({ content: TILT });
  /* Long enough for a level that animates itself into place. */
  await page.waitForTimeout(900);

  const shot = await page.evaluate(extractBoxes);
  const look = rasterize(shot.boxes, shot.view);

  /* ── 1. Something to play ─────────────────────────────────────────────
     A level whose region list is nothing but run chrome has no move. This is
     the check that would have caught L11's canvas and L39's dropdowns, both
     of which arrived as blank rows and cost an agent its run. */
  if (playable(look.regions).length === 0) {
    /* A level that needs a verb the tool surface does not have is a declared
       fact rather than a defect — but it is still worth printing every run, so
       the list stays honest and nobody has to remember it. */
    found.push(
      isUnplayable(level)
        ? { level: where, check: "known-unplayable", detail: `needs ${reasonFor(level)}` }
        : { level: where, check: "nothing-to-play", detail: "no region but the run chrome" },
    );
  }

  /* ── 2. Every coordinate we publish is one that works ─────────────────
     `toPixels` turns a grid coordinate back into the pixel at that cell's
     centre. A region whose coordinate lands on the page behind it is worse
     than no region: it reads as "this control is inert". */
  for (const r of look.regions) {
    if (r.kind === "panel" || r.kind === "drawing" || r.kind === "heading") continue;
    const { px, py } = toPixels(r.x, r.y);
    /* Resolved exactly as `Arena.click` resolves it, because the question is
       whether an agent aiming at this coordinate reaches the control — not
       whether the arithmetic centre of the cell happens to land on it. Using a
       stricter probe than the harness would report failures nobody can
       experience; using a looser one would miss the ones they can. */
    const [ax, ay] = await page.evaluate(resolvePoint, [
      px, py, VIEWPORT.width / COLS, VIEWPORT.height / ROWS, INTERACTIVE,
    ] as [number, number, number, number, string]);
    const at = await page.evaluate(probePoint, [ax, ay] as [number, number]);
    if (!at?.interactive) {
      found.push({
        level: where,
        check: "unreachable",
        detail: `(${r.x},${r.y}) ${r.kind} "${r.label}" → ${at ? at.label || "nothing usable" : "nothing"}`,
      });
    } else if (r.kind === "button" && at.cursor.endsWith("-resize")) {
      /* The L22 mislabel: tagged as a thing you press, actually a thing you
         drag. An agent that trusts the tag loses the level. */
      found.push({
        level: where,
        check: "wrong-tag",
        detail: `(${r.x},${r.y}) called a button, but the cursor over it is ${at.cursor}`,
      });
    }
  }

  /* ── 3. Nothing a person can use is missing ───────────────────────────
     The other direction, and the one that catches silence: L05's six toggles
     and L08's three wheels were both real, visible, pressable controls that
     the grid never mentioned. */
  const live = await page.evaluate(liveControls);
  for (const c of live) {
    const inside = look.regions.some((r) => {
      const a = toPixels(r.x, r.y);
      /* Within the region's stated extent, in pixels. */
      const halfW = (r.w * VIEWPORT.width) / COLS / 2 + VIEWPORT.width / COLS;
      const halfH = (r.h * VIEWPORT.height) / ROWS / 2 + VIEWPORT.height / ROWS;
      return Math.abs(a.px - c.cx) <= halfW && Math.abs(a.py - c.cy) <= halfH;
    });
    if (!inside) {
      found.push({
        level: where,
        check: "unreported",
        detail: `a ${c.cursor === "pointer" ? "clickable" : c.cursor} ${c.tag} at (${Math.round(c.cx)},${Math.round(c.cy)})px "${c.label || "unlabelled"}" is in no region`,
      });
    }
  }

  /* ── 4. Still nothing structural on the wire ──────────────────────────
     Unit-tested against hand-written boxes, and re-checked here because a real
     page is where a leak would actually come from. */
  const wire = JSON.stringify(look);
  for (const leak of ["querySelector", "className", "data-testid", "aria-label", "<div", "nodeName"]) {
    if (wire.includes(leak)) {
      found.push({ level: where, check: "leak", detail: `the grid carried ${leak}` });
    }
  }

  return found;
}

/**
 * A finding, checked twice.
 *
 * Levels animate — a progress bar climbs, an interstitial counts down, a card
 * settles into place — so a single frame caught at the wrong moment can look
 * like a missing control. In CI that would be a red build nobody trusts, and
 * an untrusted check is worse than no check because it teaches people to
 * ignore it.
 *
 * So anything that fails is looked at a second time, and only what survives is
 * reported. What did *not* survive is still printed rather than swallowed: a
 * level that keeps settling is a level worth knowing about, and quietly
 * discarding it is how a real intermittent bug hides for a month.
 *
 * Only failures pay for this. A clean sweep costs one pass.
 */
async function confirmed(
  page: Page,
  level: string,
  tilted: boolean,
  settled: string[],
): Promise<Finding[]> {
  const first = await checkLevel(page, level, tilted);
  if (first.length === 0) return first;

  const second = await checkLevel(page, level, tilted);
  const real = second.filter((f) => f.check !== "known-unplayable");
  if (real.length === 0 && first.some((f) => f.check !== "known-unplayable")) {
    settled.push(`${level}${tilted ? " (tilted)" : ""}`);
  }
  return second;
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith("-"));
  const levels = only.length ? only.map((s) => s.toUpperCase()) : [...ALL_LEVEL_IDS];
  const bothWays = !args.includes("--upright-only");

  const browser: Browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const context = await browser.newContext({ viewport: VIEWPORT });
  await prepareContext(context);

  /* A few pages at once. Serially this is a minute and a half; the point of
     the sweep is that it is cheap enough to run without thinking about it. */
  const LANES = 4;
  const pages = await Promise.all(Array.from({ length: LANES }, () => context.newPage()));

  const queue = [...levels];
  const findings: Finding[] = [];
  const settled: string[] = [];
  let done = 0;

  await Promise.all(
    pages.map(async (page) => {
      for (;;) {
        const level = queue.shift();
        if (!level) return;
        if (!META_BY_ID.has(level)) {
          findings.push({ level, check: "unknown-level", detail: "not in the catalogue" });
          continue;
        }
        try {
          findings.push(...(await confirmed(page, level, false, settled)));
          if (bothWays) findings.push(...(await confirmed(page, level, true, settled)));
        } catch (err) {
          findings.push({ level, check: "threw", detail: String(err).slice(0, 120) });
        }
        done += 1;
        process.stderr.write(`\r  ${done}/${levels.length} levels`);
      }
    }),
  );
  process.stderr.write("\n\n");

  const byCheck = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byCheck.get(f.check) ?? [];
    list.push(f);
    byCheck.set(f.check, list);
  }

  for (const [check, list] of [...byCheck].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`── ${check} · ${list.length} ──`);
    for (const f of list.slice(0, 24)) console.log(`  ${f.level.padEnd(16)} ${f.detail}`);
    if (list.length > 24) console.log(`  … and ${list.length - 24} more`);
    console.log();
  }

  if (settled.length) {
    console.log(`── settled on a second look · ${settled.length} ──`);
    console.log(`  ${settled.join(", ")}`);
    console.log("  (a frame caught mid-animation, not a defect — worth watching if it recurs)\n");
  }

  /* A declared unplayable level is printed, never failed on: it is a fact
     about the tool surface that somebody has already checked and written
     down, and a sweep that stays red forever is a sweep nobody runs. */
  const defects = findings.filter((f) => f.check !== "known-unplayable");

  console.log(
    defects.length === 0
      ? `${levels.length} levels${bothWays ? ", upright and tilted" : ""}, nothing to report.`
      : `${defects.length} finding${defects.length === 1 ? "" : "s"} across ` +
        `${new Set(defects.map((f) => f.level)).size} screen` +
        `${new Set(defects.map((f) => f.level)).size === 1 ? "" : "s"}.`,
  );

  await browser.close();
  process.exit(defects.length === 0 ? 0 : 1);
}

await main();
