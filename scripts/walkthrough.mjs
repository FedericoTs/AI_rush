#!/usr/bin/env node
/**
 * A walkthrough clip: six of the levels, played properly, with the joke
 * captioned.
 *
 * This is a promo tool, not a test. It drives the real game in a real browser
 * and records what happens, so the clip cannot show anything the game does not
 * actually do — which matters more than it sounds, because the whole subject
 * is interfaces that lie.
 *
 * Two things it adds that a bare recording does not have:
 *
 *   A visible cursor. Playwright moves a real mouse but paints nothing, so
 *   without this the video is a sequence of things happening for no reason.
 *   The pointer here is driven by the page's own `pointermove` events, so it
 *   is showing where the mouse genuinely is rather than where we meant it.
 *
 *   Deliberate pacing. Every trap needs a beat before the click or the viewer
 *   has not seen it yet, and every reveal needs a beat after or they have not
 *   understood it. Real playing is much faster than watchable playing.
 *
 *   npm i --no-save ffmpeg-static      # for the mp4; the webm needs nothing
 *   node scripts/walkthrough.mjs
 *   ARENA_URL=http://127.0.0.1:3000 node scripts/walkthrough.mjs
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, renameSync } from "node:fs";
import { join } from "node:path";

const GAME = process.env.ARENA_URL ?? "http://127.0.0.1:3000";
const OUT = process.env.WALKTHROUGH_OUT ?? "walkthrough";
const RAW = join(OUT, "raw");

/*
 * Phone-shaped, and sized to what is actually on screen.
 *
 * The first cut used 540×960 and the level card occupied the top fifth of the
 * frame with a void under it — measured, the card is 538px tall from y=55, and
 * nothing is painted below about y=593 at any viewport height. Vertical video
 * that is four-fifths empty is not a clip anyone watches.
 *
 * 432×768 is exactly 9:16, leaves the card filling three-quarters of the
 * height, and keeps the rest for the caption. A 2.5× device pixel ratio makes
 * the 1080×1920 recording native rather than upscaled.
 */
const VIEW = { width: 432, height: 768 };
const VIDEO = { width: 1080, height: 1920 };

/* The chain. `?level=` takes a comma list and plays them in order, so this is
   one continuous practice run rather than six recordings stitched together. */
const LEVELS = ["L01", "L05", "L27", "L22", "L11", "L36"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── the overlay ────────────────────────────────────────────────────────
   Injected before the app loads and never touched again: `pointer-events:
   none` throughout, so nothing here can absorb a click meant for the game. */
const OVERLAY = () => {
  const paint = () => {
    if (document.getElementById("__wt")) return;

    const style = document.createElement("style");
    style.textContent = `
      #__cur{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;
        border-radius:50%;border:2px solid rgba(255,255,255,.95);
        box-shadow:0 0 0 2px rgba(0,0,0,.55),0 2px 10px rgba(0,0,0,.5);
        z-index:2147483647;pointer-events:none;transition:transform .04s linear}
      #__cur::after{content:"";position:absolute;inset:9px;border-radius:50%;background:#fff}
      #__ring{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;
        border-radius:50%;border:2px solid #ff4d3d;opacity:0;z-index:2147483646;pointer-events:none}
      @keyframes __pop{from{transform:scale(1);opacity:.9}to{transform:scale(2.6);opacity:0}}
      #__cap{position:fixed;left:0;right:0;bottom:0;z-index:2147483645;pointer-events:none;
        padding:18px 20px 26px;font:600 20px/1.35 ui-sans-serif,system-ui,sans-serif;
        color:#fff;text-align:center;
        background:linear-gradient(to top,rgba(0,0,0,.92) 55%,rgba(0,0,0,0));
        opacity:0;transition:opacity .28s ease}
      #__cap b{color:#ff4d3d}

      /*
       * A chapter band, because the frame cannot be filled by the card alone.
       *
       * Measured across the six: the cards are 408 wide by 265–519 tall, which
       * is landscape-ish for most of them, and the card is already 94% of the
       * viewport width so it cannot be scaled up — width is the binding
       * constraint at ×1.02. Filling a 9:16 frame by zooming would crop the
       * controls; shrinking the tall one to match the short one would halve its
       * text. Neither is acceptable.
       *
       * So the space above and below stops being letterboxing and becomes
       * composition: which level this is, how far through we are, and the line
       * explaining the trap. The frame is then fully used at every moment, and
       * the reader always knows where they are — which is what a short needs
       * anyway.
       */
      #__top{position:fixed;left:0;right:0;top:0;height:104px;z-index:2147483644;
        pointer-events:none;padding:14px 18px 0;
        background:linear-gradient(to bottom,#0b0e13 62%,rgba(11,14,19,0));
        display:flex;flex-direction:column;gap:9px;opacity:0;transition:opacity .3s ease}
      #__bar{display:flex;gap:4px}
      #__bar i{flex:1;height:3px;border-radius:2px;background:#262d38}
      #__bar i.on{background:#ff4d3d}
      #__num{font:700 11px/1 ui-monospace,monospace;letter-spacing:.18em;color:#69737f}
      #__ttl{font:800 19px/1.15 ui-sans-serif,system-ui,sans-serif;color:#fff;
        letter-spacing:-.01em}

      #__hook{position:fixed;inset:0;z-index:2147483646;pointer-events:none;
        display:flex;align-items:center;justify-content:center;padding:0 34px;
        background:rgba(11,14,19,.86);opacity:0;transition:opacity .45s ease;
        /* 40px overflowed "interfaces" at 432 wide and stranded the last word
           on its own line. Sized to the frame, with the breaks written by hand
           rather than left to the wrap. */
        font:800 31px/1.18 ui-sans-serif,system-ui,sans-serif;color:#fff;text-align:center;
        letter-spacing:-.02em;text-wrap:balance}
      #__hook u{text-decoration:none;color:#ff4d3d}
      #__end{position:fixed;inset:0;z-index:2147483647;pointer-events:none;opacity:0;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
        background:#0b0e13;color:#fff;font:800 46px/1.1 ui-sans-serif,system-ui,sans-serif;
        transition:opacity .5s ease;text-align:center}
      #__end span{font:500 19px/1.5 ui-sans-serif,system-ui,sans-serif;color:#9aa6b4;
        max-width:22ch}
      #__end em{display:block;font-style:normal;color:#ff4d3d;font-weight:700;margin-top:6px}

      /*
       * Centre the card in the frame, above the caption band.
       *
       * The game top-aligns, which is right on a phone you are holding and
       * wrong in a 9:16 video: a short level like L01 is two buttons, so the
       * first cut had it pinned to the top of an otherwise black frame. This
       * moves nothing and hides nothing — the card, its contents and every
       * control are exactly as the site renders them, they are simply in the
       * middle of the shot.
       */
      [data-level]{margin-top:auto!important;margin-bottom:auto!important}
      main > div{justify-content:center!important;
        padding-top:104px!important;padding-bottom:132px!important}
    `;
    document.head.append(style);

    const cur = document.createElement("div");
    cur.id = "__cur";
    const ring = document.createElement("div");
    ring.id = "__ring";
    const cap = document.createElement("div");
    cap.id = "__cap";
    const end = document.createElement("div");
    end.id = "__end";
    const top = document.createElement("div");
    top.id = "__top";
    top.innerHTML = '<div id="__bar"></div><div id="__num"></div><div id="__ttl"></div>';
    const hook = document.createElement("div");
    hook.id = "__hook";
    const wrap = document.createElement("div");
    wrap.id = "__wt";
    wrap.style.cssText = "position:fixed;pointer-events:none";
    document.body.append(wrap, top, hook, ring, cur, cap, end);

    const at = (el, x, y) => { el.style.transform = `translate(${x}px,${y}px)`; };
    /* Driven by the page's own events, so the ring is where the mouse really
       is — not where the script believed it would end up. */
    addEventListener("pointermove", (e) => at(cur, e.clientX, e.clientY), true);
    addEventListener("pointerdown", (e) => {
      at(ring, e.clientX, e.clientY);
      ring.style.animation = "none";
      void ring.offsetWidth;
      ring.style.animation = "__pop .45s ease-out";
    }, true);

    window.__say = (html) => {
      cap.style.opacity = "0";
      setTimeout(() => {
        if (!html) return;
        cap.innerHTML = html;
        cap.style.opacity = "1";
      }, 180);
    };
    window.__chapter = (n, total, title) => {
      const bar = top.querySelector("#__bar");
      bar.innerHTML = Array.from({ length: total }, (_, i) =>
        `<i class="${i < n ? "on" : ""}"></i>`).join("");
      top.querySelector("#__num").textContent = `LEVEL ${n} OF ${total}`;
      top.querySelector("#__ttl").textContent = title;
      top.style.opacity = "1";
    };
    window.__hook = (html) => {
      hook.innerHTML = html ?? "";
      hook.style.opacity = html ? "1" : "0";
    };
    window.__end = (title, sub) => {
      top.style.opacity = "0";
      end.innerHTML = `<div>${title}</div><span>${sub}</span>`;
      end.style.opacity = "1";
    };
  };

  if (document.body) paint();
  else addEventListener("DOMContentLoaded", paint);
};

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(RAW, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 2.5,
    recordVideo: { dir: RAW, size: VIDEO },
    /* Cursor motion is scripted; a reduced-motion preference would also flatten
       the level animations the clip exists to show. */
    reducedMotion: "no-preference",
  });

  await ctx.addInitScript(() => {
    /* Answer the calibration screen the way a machine honestly would, so the
       clip starts on a level rather than on a permissions prompt. */
    try {
      window.localStorage.setItem("ai-rush:sensors", "declined");
    } catch {
      /* Storage blocked. The calibration screen appears and the clip opens on
         it instead — visible immediately, rather than a silent wrong take. */
    }
  });
  await ctx.addInitScript(OVERLAY);

  const page = await ctx.newPage();

  const say = (html) => page.evaluate((h) => window.__say?.(h), html);

  /* Mouse motion a viewer can follow. Playwright's default is a teleport,
     which on video reads as a cut rather than a movement. */
  let mx = VIEW.width / 2;
  let my = VIEW.height + 40;
  async function glide(x, y, steps = 26) {
    const fromX = mx;
    const fromY = my;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      /* Ease out, so it arrives the way a hand does rather than at a
         constant machine speed. */
      const e = 1 - Math.pow(1 - t, 3);
      await page.mouse.move(fromX + (x - fromX) * e, fromY + (y - fromY) * e);
      await sleep(11);
    }
    mx = x;
    my = y;
  }

  const centre = async (locator) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error("nothing to aim at");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  async function press(locator, settle = 420) {
    const { x, y } = await centre(locator);
    await glide(x, y);
    await sleep(260);
    await page.mouse.click(x, y);
    await sleep(settle);
  }

  await page.goto(`${GAME}/play?level=${LEVELS.join(",")}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-level]", { timeout: 20_000 });
  await sleep(250);

  // ── L01 ───────────────────────────────────────────────────────────────
  /* The hook sits over the first level rather than before it, so the frame is
     never a title card the viewer has to wait out. */
  await page.evaluate(() =>
    window.__hook?.('49 interfaces<br>built to make you <u>fail</u>.'));
  await sleep(1700);
  await page.evaluate(() => window.__hook?.(null));
  await page.evaluate(() => window.__chapter?.(1, 6, "Continue To Your Account"));
  await say("Every button here is lying to you.");
  await sleep(1800);
  await say("Cancel is green. Continue has a <b>warning triangle</b>.");
  await sleep(2500);
  /*
   * The caption goes up BEFORE the click, not after.
   *
   * Clicking Cancel swaps the colours sane and swaps them back after 400ms.
   * Captioning it afterwards described something the viewer never saw — and a
   * clip about interfaces that lie cannot itself claim things it does not
   * show. Said first, the swap happens while the sentence is already on screen.
   */
  await say("Watch. Cancel fixes the colours — for <b>0.4 seconds</b>.");
  await sleep(1900);
  await press(page.getByRole("button", { name: "Cancel" }), 1800);
  await press(page.getByRole("button", { name: /Continue/ }), 900);

  // ── L05 ───────────────────────────────────────────────────────────────
  await page.waitForSelector("text=We Value Your Privacy", { timeout: 10_000 });
  await page.evaluate(() => window.__chapter?.(2, 6, "We Value Your Privacy"));
  await say("47 partners. There is a Reject All.");
  await sleep(2300);
  await press(page.getByRole("button", { name: "Reject All" }), 700);
  await say("Reject All switched all 47 <b>on</b>.");
  await sleep(2600);
  await press(page.getByRole("button", { name: "Legitimate Interest" }), 500);
  await say("The refusal that works is on the other tab.");
  await sleep(1900);
  await press(page.getByRole("button", { name: "Object to all" }), 700);
  await say("Now Accept All stops being greyed out.");
  await sleep(1800);
  await press(page.getByRole("button", { name: "Accept All" }), 900);

  // ── L27 ───────────────────────────────────────────────────────────────
  await page.waitForSelector("text=Confirm Your Address", { timeout: 10_000 });
  await page.evaluate(() => window.__chapter?.(3, 6, "Confirm Your Address"));
  await say("It shows you the address it wants.");
  await sleep(2200);
  const field = page.getByLabel("Address");
  await press(field, 400);
  await say("So type it.");
  await sleep(900);
  await page.keyboard.type("221B Baker Street, London", { delay: 55 });
  await sleep(1600);
  await say('"Our AI matcher gets smarter the more you type."');
  await sleep(2600);
  await say("It ranks by <b>worst</b> match. Every letter made it worse.");
  await sleep(2800);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await sleep(1100);
  await say("Type nothing. It was first the whole time.");
  await sleep(2200);
  await press(page.getByRole("option", { name: "221B Baker Street, London" }), 900);

  // ── L22 ───────────────────────────────────────────────────────────────
  await page.waitForSelector("text=Loading Your Dashboard", { timeout: 10_000 });
  await page.evaluate(() => window.__chapter?.(4, 6, "Loading Your Dashboard"));
  await say("Loading. It has been at 99% for a while.");
  await sleep(3200);
  await say("The real progress is in the corner. <b>Nine pixels tall.</b>");
  await sleep(3000);
  const tiny = page.getByRole("button", { name: "Actual progress" });
  const spot = await centre(tiny);
  await glide(spot.x, spot.y);
  await sleep(400);
  await say("You have to drag it up yourself.");
  await sleep(1500);
  await page.mouse.down();
  /* Down first, then a long sweep up: the level accumulates signed movement
     rather than endpoints, and it resists above 85%, so this needs roughly
     five hundred pixels of travel to finish. */
  for (const [x, y] of [[spot.x, VIEW.height - 28], [spot.x - 30, 40]]) {
    /* Cleared between the two sweeps, because the level completes partway up
       and advances while the pointer is still down — the first cut left "you
       have to drag it up yourself" sitting under a dinosaur for a full second.
       Waiting for the mouse to lift is too late. */
    if (y < 100) await say("");
    const fromX = mx, fromY = my;
    for (let i = 1; i <= 34; i++) {
      const t = i / 34;
      await page.mouse.move(fromX + (x - fromX) * t, fromY + (y - fromY) * t);
      await sleep(14);
    }
    mx = x; my = y;
  }
  await page.mouse.up();
  await sleep(1100);

  // ── L11 ───────────────────────────────────────────────────────────────
  await page.waitForSelector("text=Choose A Secure Password", { timeout: 10_000 });
  await page.evaluate(() => window.__chapter?.(5, 6, "Choose A Secure Password"));
  await say("Your password is dispensed by a dinosaur.");
  await sleep(1400);
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("Space");
    await sleep(420);
  }
  await say("You jump to collect the characters. I am not beating this one.");
  await sleep(2600);
  await press(page.getByRole("button", { name: "SKIP THIS LEVEL" }), 900);

  // ── L36 ───────────────────────────────────────────────────────────────
  await page.waitForSelector("text=Sign in", { timeout: 10_000 });
  await page.evaluate(() => window.__chapter?.(6, 6, "Sign In"));
  await say("Last one. Find the trick.");
  await sleep(4200);
  await say("There isn't one. It is a completely normal login form.");
  await sleep(3400);
  await press(page.getByLabel(/Email/i).first(), 250);
  await page.keyboard.type("me@example.com", { delay: 48 });
  await sleep(500);
  await press(page.getByLabel(/Password/i).first(), 250);
  await page.keyboard.type("hunter2!", { delay: 48 });
  await sleep(700);
  await say("It is the level people take the longest to beat.");
  await sleep(2400);
  await press(page.getByRole("button", { name: /^Sign in$/ }), 1200);

  await say("");
  await page.evaluate(() =>
    window.__end?.("AI RUSH", "49 hostile interfaces.<br>Five minutes.<em>ai-rush.lol</em>"),
  );
  await sleep(3200);

  await page.close();
  await ctx.close();
  await browser.close();

  // ── mux ───────────────────────────────────────────────────────────────
  const webm = readdirSync(RAW).find((f) => f.endsWith(".webm"));
  if (!webm) throw new Error("playwright recorded nothing");
  const src = join(RAW, webm);
  const mp4 = join(OUT, "ai-rush-walkthrough.mp4");

  renameSync(src, join(OUT, "ai-rush-walkthrough.webm"));
  const webmOut = join(OUT, "ai-rush-walkthrough.webm");

  /*
   * The mp4 is what social uploaders actually accept, and the encoder for it
   * is not a project dependency.
   *
   * Playwright ships its own ffmpeg but it is built `--disable-everything`
   * with only VP8 and webm enabled, so it cannot produce one. A real static
   * build can, and it is eighty megabytes — too much to put in `devDependencies`
   * where four CI jobs would download it on every push, for a script that runs
   * when somebody wants a promo clip.
   *
   * So it is optional, and its absence costs you the container rather than the
   * recording: the webm is already written and playable.
   */
  let ffmpeg;
  try {
    ({ default: ffmpeg } = await import("ffmpeg-static"));
  } catch {
    console.log(`\n${webmOut}\n\nFor an mp4: npm i --no-save ffmpeg-static, then run this again.`);
    rmSync(RAW, { recursive: true, force: true });
    return;
  }

  /* H.264 high profile, yuv420p, +faststart: the combination every social
     uploader accepts without re-encoding it into mush. */
  execFileSync(ffmpeg, [
    "-y", "-i", webmOut,
    "-c:v", "libx264", "-preset", "slow", "-crf", "20",
    "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-vf", `scale=${VIDEO.width}:${VIDEO.height}:flags=lanczos,fps=30`,
    "-movflags", "+faststart",
    "-an",
    mp4,
  ], { stdio: "inherit" });

  rmSync(RAW, { recursive: true, force: true });
  console.log(`\n${mp4}`);
}

await main();
