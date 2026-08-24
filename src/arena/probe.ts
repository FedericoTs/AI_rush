import { chromium } from "playwright";
import { COLS, ROWS, rasterize, render } from "./raster";
import { extractBoxes } from "./extract";
import { prepareContext } from "./page";

/**
 * What a level looks like through the grid.
 *
 * The rasterizer's unit tests prove its rules against hand-written layouts.
 * They cannot prove the thing that actually matters — that a real level, drawn
 * by real CSS, comes out the other side **legible and still hard**. That is a
 * judgement, and it needs eyes on the output.
 *
 * So this prints it. Run it against a level before shipping a change to the
 * extractor or the rasterizer, and read what an agent would read:
 *
 *   npm run arena:probe -- L01 L06 L22 L36
 *   ARENA_URL=http://127.0.0.1:3000 npm run arena:probe -- L22
 *
 * Two things to look for, and they pull against each other:
 *
 *   **Legible.** Every word a player can read must survive. If a button's
 *   label is gone, the agent is being asked to click something it cannot see,
 *   and that is not difficulty, it is a broken channel.
 *
 *   **Still hard.** The grid must not accidentally *help*. If L22's nine-pixel
 *   number arrives as prominent as the heading, the level has been solved by
 *   the renderer. If a password field's contents appear, the mode is pointless.
 */

const GAME_URL = process.env.ARENA_URL ?? "https://ai-rush.lol";
const VIEWPORT = { width: 480, height: 720 };

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error("Usage: npm run arena:probe -- L01 L22 …   (level ids)");
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const context = await browser.newContext({ viewport: VIEWPORT });
await prepareContext(context);

const page = await context.newPage();

for (const id of ids) {
  /* The practice room: one level, no clock, nothing filed. Exactly the right
     harness for looking at a single screen. */
  const url = new URL("/play", GAME_URL);
  url.searchParams.set("level", id);
  url.searchParams.set("seed", "ABC123");

  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  /* Levels animate in. Half a second is enough for a card to settle and short
     enough that a level with a timer has not resolved itself. */
  await page.waitForTimeout(600);

  const { boxes, view, finished } = await page.evaluate(extractBoxes);
  const look = rasterize(boxes, view);

  console.log(`\n${"═".repeat(COLS + 4)}`);
  console.log(`  ${id}   ${boxes.length} boxes → ${COLS}×${ROWS}${finished ? "   (finished)" : ""}`);
  console.log("═".repeat(COLS + 4));
  console.log(render(look));
}

await browser.close();
