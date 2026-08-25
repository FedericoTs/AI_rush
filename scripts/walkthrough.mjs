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
 *   A poster on the first frame. Most platforms take frame zero as the
 *   thumbnail, and frame zero of a browser recording is a blank white page.
 *
 * Writes `ai-rush-walkthrough.mp4`, the raw `.webm`, and `thumbnail.png`.
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
 * The viewport IS the video, and the phone layout comes from `zoom`.
 *
 * ── The trap this exists to avoid ────────────────────────────────────────
 *
 * The obvious setup — a 432×768 viewport, `deviceScaleFactor: 2.5`, and
 * `recordVideo.size` of 1080×1920 — silently produces a video whose content
 * occupies the **top-left 40% of the frame** and nothing else. Playwright
 * scales a page *down* to fit the requested size and never up, so asking for
 * a size larger than the viewport pads it. 432/1080 = 0.4 exactly.
 *
 * That shipped once. It survived a contact sheet because the grey padding in
 * the frames was indistinguishable from the grey padding the `tile` filter
 * adds between thumbnails. The check that actually catches it is a `drawbox`
 * border drawn at the frame's true edges, which no amount of tiling can fake.
 *
 * ── What works instead ───────────────────────────────────────────────────
 *
 * Make the viewport the video's real size and zoom the document. Layout then
 * runs at 1080/2.5 = 432 effective CSS pixels — the phone width the game is
 * designed for — while every pixel is rendered at full resolution. Measured
 * against a native 432×768 recording, the composition is identical; it is
 * simply 2.5× sharper and fills the frame.
 *
 * Everything in the overlay below is written in the same effective units and
 * scales with it, including the mouse coordinates, because `zoom` moves the
 * whole coordinate space together — so nothing else in this file changes.
 */
const ZOOM = 2.5;
const VIEW = { width: 1080, height: 1920 };
const VIDEO = { width: 1080, height: 1920 };


/* The chain. `?level=` takes a comma list and plays them in order, so this is
   one continuous practice run rather than six recordings stitched together. */
const LEVELS = ["L01", "L05", "L27", "L22", "L11", "L36"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── the overlay ────────────────────────────────────────────────────────
   Injected before the app loads and never touched again: `pointer-events:
   none` throughout, so nothing here can absorb a click meant for the game. */
const OVERLAY = () => {
  /* Before anything else, and deliberately not inside `paint`.
     The poster cannot exist until there is a `<body>` to append it to, and
     the frames between navigation and that moment are white. The root
     element does exist by the time an init script runs, and its background
     is what fills the viewport until the app paints its own. Handed back in
     `__poster("off")`. */
  try {
    document.documentElement.style.background = "#0b0e13";
  } catch {
    /* No document yet — the poster below still covers everything from
       DOMContentLoaded on, and the encode trims the head of the recording. */
  }

  const paint = () => {
    if (document.getElementById("__wt")) return;

    const style = document.createElement("style");
    style.textContent = `
      #__cur{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;
        border-radius:50%;border:2px solid rgba(255,255,255,.95);
        box-shadow:0 0 0 2px rgba(0,0,0,.55),0 2px 10px rgba(0,0,0,.5);
        z-index:2147483647;pointer-events:none;transition:transform .04s linear;
        /* Parked off-screen until the first pointermove. Untransformed it
           sits at the origin, and a quarter of a white ring in the top-left
           corner is the first thing the viewer sees after the poster lifts. */
        transform:translate(-200px,-200px)}
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

      /*
       * The poster — the first frame, and therefore the thumbnail.
       *
       * Every platform that does not let you upload a custom thumbnail uses
       * frame zero, and frame zero of a Playwright recording is the blank
       * document before the app has painted anything: pure white. A white
       * still is the worst possible advertisement for a game about screens.
       *
       * So this is opaque from the first script that runs on the page, and
       * then *lifts* rather than disappearing: the cover fades and leaves two
       * bands, with the real L01 card showing through the gap between them —
       * a green Cancel beside a red ⚠ Continue. That composition asks the
       * viewer a question they answer in their head before they have decided
       * whether to watch, which is the entire job of a thumbnail.
       *
       * Nothing here is a mock-up. It is the game, with a headline over it.
       *
       * The bands are also why the middle is a transparent window rather than
       * a hole punched at fixed pixels: the card is centred by the rules
       * further down, so the window only has to be wider than the tallest
       * card the poster is ever held over.
       */
      #__poster{position:fixed;inset:0;z-index:2147483647;pointer-events:none;
        display:flex;flex-direction:column;justify-content:space-between;
        padding:40px 24px 34px;text-align:center;opacity:1;
        transition:opacity .45s ease;
        background:linear-gradient(to bottom,
          #0b0e13 0%,#0b0e13 23%,rgba(11,14,19,0) 30%,
          rgba(11,14,19,0) 70%,#0b0e13 77%,#0b0e13 100%)}
      /* The cover proper: what is up before the level has painted. Separate
         from the gradient so lifting it is one opacity transition and the
         bands survive it. */
      #__poster::before{content:"";position:absolute;inset:0;background:#0b0e13;
        transition:opacity .55s ease}
      #__poster.lift::before{opacity:0}
      /* Positioned, so they paint above the absolutely-positioned cover
         instead of underneath it. */
      #__poster > div{position:relative}
      #__poster .k{font:700 12px/1 ui-monospace,monospace;letter-spacing:.26em;
        color:#ff4d3d;margin-bottom:13px}
      #__poster .h{font:800 40px/1.06 ui-sans-serif,system-ui,sans-serif;color:#fff;
        letter-spacing:-.03em}
      #__poster .h u{text-decoration:none;color:#ff4d3d}
      #__poster .s{font:600 18px/1.4 ui-sans-serif,system-ui,sans-serif;color:#9aa6b4}
      #__poster .s em{display:block;font-style:normal;font-weight:800;font-size:22px;
        color:#ff4d3d;margin-top:9px;letter-spacing:-.01em}

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
    const poster = document.createElement("div");
    poster.id = "__poster";
    poster.innerHTML =
      '<div><div class="k">LEVEL 1 OF 49</div>' +
      '<div class="h">WHICH ONE<br><u>CONTINUES</u>?</div></div>' +
      '<div class="s">49 interfaces built to make you fail.<em>ai-rush.lol</em></div>';
    const wrap = document.createElement("div");
    wrap.id = "__wt";
    wrap.style.cssText = "position:fixed;pointer-events:none";
    document.body.append(wrap, top, ring, cur, cap, poster, end);

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
    /* "lift" fades the cover and leaves the bands; "off" takes the whole
       thing away and hands the document background back to the game. */
    window.__poster = (state) => {
      if (state === "lift") poster.classList.add("lift");
      else {
        poster.style.opacity = "0";
        document.documentElement.style.background = "";
      }
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
    deviceScaleFactor: 1,
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
  await ctx.addInitScript((z) => {
    /* Set on the root so layout, media queries and the overlay all agree.
       Applied at DOMContentLoaded because `document.documentElement` has to
       exist and the app must lay out with it already in force. */
    const apply = () => { document.documentElement.style.zoom = String(z); };
    if (document.documentElement) apply();
    else addEventListener("DOMContentLoaded", apply);
  }, ZOOM);
  await ctx.addInitScript(OVERLAY);

  /* The recording's clock starts here, at the page rather than the context.
     Held so the encode can trim everything before the poster is up. */
  const page = await ctx.newPage();
  const openedAt = Date.now();

  const say = (html) => page.evaluate((h) => window.__say?.(h), html);

  /* Mouse motion a viewer can follow. Playwright's default is a teleport,
     which on video reads as a cut rather than a movement. */
  let mx = VIEW.width / 2;
  let my = VIEW.height + 100;
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
  /* Long enough for the card's own entrance to finish. The poster is held
     over a settled level, not over one still animating in. */
  await sleep(600);

  // ── the poster ────────────────────────────────────────────────────────
  await page.evaluate(() => window.__poster?.("lift"));
  await sleep(750);
  /* Frame zero of the finished mp4 is this instant. Everything before it is
     the white blank page and the cover fading, and the encode drops it. */
  const posterAt = Date.now();
  /* Also written out on its own, at full resolution, for the platforms that
     do accept an uploaded thumbnail. */
  await page.screenshot({ path: join(OUT, "thumbnail.png") });
  await sleep(1800);

  // ── L01 ───────────────────────────────────────────────────────────────
  /* The chapter band goes up *behind* the poster and is given its own fade to
     finish before the poster leaves. Taking the poster off first left the
     game's own HUD — logo, PRACTICE 1/6, the clock — uncovered for the better
     part of a second, which reads as a mistake rather than a transition. */
  await page.evaluate(() => window.__chapter?.(1, 6, "Continue To Your Account"));
  await sleep(360);
  await page.evaluate(() => window.__poster?.("off"));
  await sleep(520);
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
    /* The webm still has the white head on it — trimming that is the mp4
       pass's job — so the separate thumbnail matters more on this path. */
    console.log(
      `\n${webmOut}\n${join(OUT, "thumbnail.png")}` +
        `\n\nFor an mp4: npm i --no-save ffmpeg-static, then run this again.`,
    );
    rmSync(RAW, { recursive: true, force: true });
    return;
  }

  /*
   * Trim the head, so frame zero is the poster.
   *
   * Measured rather than guessed: `posterAt - openedAt` is how long the page
   * existed — and therefore how much video was recorded — before the poster
   * was fully up. A quarter-second is left on to absorb drift between the
   * wall clock and the recorder's own timeline, which is comfortably inside
   * the fade's own margin at one end and the poster's 1.8s hold at the other.
   *
   * `-ss` goes *after* `-i` on purpose: an input-side seek lands on the
   * nearest keyframe, and "nearest" is exactly the thing that would put a
   * white frame back at the front.
   *
   * The webm keeps its head. It is the raw record and the fallback for a
   * machine with no encoder; the mp4 is the thing anybody posts.
   */
  const trim = Math.max(0, (posterAt - openedAt) / 1000 - 0.25);

  /* H.264 high profile, yuv420p, +faststart: the combination every social
     uploader accepts without re-encoding it into mush. */
  execFileSync(ffmpeg, [
    "-y", "-i", webmOut,
    ...(trim > 0.05 ? ["-ss", trim.toFixed(3)] : []),
    "-c:v", "libx264", "-preset", "slow", "-crf", "20",
    "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-vf", `scale=${VIDEO.width}:${VIDEO.height}:flags=lanczos,fps=30`,
    "-movflags", "+faststart",
    "-an",
    mp4,
  ], { stdio: "inherit" });

  rmSync(RAW, { recursive: true, force: true });
  console.log(`\n${mp4}\n${join(OUT, "thumbnail.png")}`);
}

await main();
