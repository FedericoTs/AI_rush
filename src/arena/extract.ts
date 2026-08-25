import type { Box } from "./raster";

/**
 * The half that runs inside the page.
 *
 * Deliberately dumb. Everything that decides what the agent *perceives* lives
 * in `raster.ts`, where it is a pure function over plain data and can be
 * tested against hand-written layouts; this only answers "what text is on
 * screen and where". Splitting it that way is what keeps the piece
 * `AGENT_ARENA.md` calls the real technical risk out of a browser.
 *
 * It is serialised and evaluated in the page, so it must be self-contained:
 * no imports at runtime, no closure over anything outside itself.
 *
 * ── The rule it enforces ─────────────────────────────────────────────────
 *
 * Not one element id, class, tag name, selector, attribute or accessibility
 * label leaves this function. `kind` is what a thing *looks like*, not what it
 * is: a `div` styled as a button is reported as a button, because that is what
 * a person would call it, and an agent that could tell the difference would be
 * reading the source rather than the screen.
 */

/** What `extractBoxes` returns, before it crosses back out of the page. */
export interface Extracted {
  boxes: Box[];
  view: { width: number; height: number };
  /** Present only if the run has ended, so the harness knows to stop. */
  finished: boolean;
}

/**
 * Runs in the page. Written as a single expression body with no external
 * references so `page.evaluate` can serialise it.
 */
export function extractBoxes(): Extracted {
  const boxes: Box[] = [];
  const view = { width: window.innerWidth, height: window.innerHeight };

  const isOpaque = (bg: string): boolean => {
    if (!bg || bg === "transparent") return false;
    const m = /^rgba?\(([^)]+)\)$/.exec(bg);
    if (!m) return true;
    const parts = m[1]!.split(",").map((p) => Number(p.trim()));
    /* Anything above half opacity hides what is behind it well enough that a
       person would stop reading through it. */
    return parts.length < 4 || (parts[3] ?? 1) > 0.5;
  };

  /*
   * Actually on screen, not merely positioned on screen.
   *
   * The rectangle tests below are necessary and nowhere near sufficient. A
   * probe of L05 found the answer: its consent list scrolls inside a fixed
   * box, and every one of the forty-seven partners below the fold still has a
   * `getBoundingClientRect()` inside the viewport. The agent was being shown
   * eleven rows the player cannot see.
   *
   * So the last check is a hit test at the element's centre: what is actually
   * painted there has to be this element or something inside it.
   *
   * An **ancestor** is deliberately not good enough, and that distinction is
   * the whole fix. A clipped row's centre lands on the scroll container that
   * is hiding it — which is one of its ancestors — so accepting ancestors
   * accepts precisely the rows this is meant to reject. The first attempt did
   * exactly that and the probe still showed eleven invisible partners.
   */
  const centreOf = (rect: DOMRect) => ({
    cx: Math.min(view.width - 1, Math.max(0, rect.left + rect.width / 2)),
    cy: Math.min(view.height - 1, Math.max(0, rect.top + rect.height / 2)),
  });

  const hitTested = (el: Element, rect: DOMRect): boolean => {
    const { cx, cy } = centreOf(rect);
    const hit = document.elementFromPoint(cx, cy);
    return hit !== null && (hit === el || el.contains(hit));
  };

  const visible = (el: Element, style: CSSStyleDeclaration, rect: DOMRect): boolean =>
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < view.height &&
    rect.left < view.width &&
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    Number(style.opacity) > 0.05 &&
    !el.hasAttribute("hidden") &&
    hitTested(el, rect);

  /*
   * What a person would call this thing.
   *
   * Appearance first, role second — a `div` with a border and a click handler
   * is a button to anybody looking at it, and the whole mode depends on the
   * agent seeing what is drawn rather than what is declared.
   */
  const kindOf = (el: Element, style: CSSStyleDeclaration): Box["kind"] => {
    const tag = el.tagName.toLowerCase();
    /*
     * Something is painted here and you cannot read it.
     *
     * A `canvas` has no text and no children, so it was dropped before it
     * reached the grid — which is how L11's runner game arrived as five blank
     * rows under the caption "tap / space to jump". The level is *meant* to be
     * near-impossible for an agent (§4: "the flailing is the show"), but
     * flailing at an interface you can see is a different thing from being
     * told there is nothing there. The first is the joke; the second is us
     * lying about the screen.
     *
     * So it is reported as an area with no content whatsoever. Not what is
     * drawn in it, not a description, not a hint — a rectangle, and the fact
     * that a person would see *something* in it. That keeps the level exactly
     * as hard as it was designed to be while making it possible to play.
     */
    if (tag === "canvas" || tag === "img" || tag === "svg" || tag === "video") return "drawing";
    if (tag === "input" || tag === "textarea" || tag === "select") return "field";

    /*
     * Something you drag.
     *
     * The browser paints a different cursor over a draggable control, and that
     * cursor is an affordance a person reads without thinking — `ns-resize`
     * over L08's date wheels says "pull me up and down" as plainly as a label
     * would. The grid was silent about it: the wheels are `div`s whose values
     * live in child spans, so they appeared as three bare numbers in no region
     * at all, and a blind run had to infer their bounds from glyph positions
     * and then discover by trial that a drag only registers if it starts on
     * exactly the right row.
     *
     * Reported as a place and a value, never as an instruction. How far a
     * flick travels, and that the momentum is non-linear, stays the level.
     *
     * ── A size floor was tried here, and it was a mistake ────────────────
     *
     * The worry was L22: its mechanic is a nine-pixel `0.00 %` you are meant
     * to *notice* beside a big friendly fake progress bar, and calling it a
     * dial looked like pointing straight at it. So a floor was added to
     * exclude anything too small to put a finger on.
     *
     * That was wrong on the facts. Checking against the previous commit showed
     * the number was **already** in the region list, as a `button` — the floor
     * never hid it, it only relabelled it. And `button` is a lie: the thing is
     * draggable, dragging it is the entire solve, and the very next run read
     * the tag, clicked it six times, and reported the level as having no
     * working control at all.
     *
     * A wrong tag is worse than a revealing one. A person hovering that number
     * gets `ns-resize` from the browser and learns the same fact; what stays
     * hard is noticing it in the first place, and the resistance and decay
     * once you have it.
     */
    const drag = style.cursor;
    if (
      drag === "ns-resize" || drag === "ew-resize" || drag === "row-resize" ||
      drag === "col-resize" || drag === "grab" || drag === "grabbing" || drag === "move"
    ) {
      return "dial";
    }
    if (tag === "button" || tag === "a" || el.getAttribute("role") === "button") return "button";
    if (/^h[1-6]$/.test(tag)) return "heading";

    const clickable = style.cursor === "pointer";
    const framed = style.borderStyle !== "none" || style.backgroundColor !== "rgba(0, 0, 0, 0)";
    if (clickable && framed) return "button";

    const weight = Number(style.fontWeight);
    const size = parseFloat(style.fontSize);
    if (weight >= 600 && size >= 18) return "heading";

    return "text";
  };

  /*
   * What a field shows.
   *
   * The *displayed* value, never the underlying one — a password field on
   * screen is a row of dots, so that is what it is here. An agent that could
   * read `input.value` on a password field would beat L06 without perceiving
   * anything, which is the exact failure this whole design exists to prevent.
   */
  const fieldText = (el: HTMLInputElement | HTMLTextAreaElement): string => {
    const type = "type" in el ? el.type : "text";
    if (type === "password") return el.value ? "•".repeat(Math.min(el.value.length, 24)) : "";
    if (type === "checkbox" || type === "radio") {
      return (el as HTMLInputElement).checked ? "[x]" : "[ ]";
    }
    return el.value || el.placeholder || "";
  };

  /*
   * What a dropdown shows: the option currently chosen, and nothing else.
   *
   * A `select` has no text children — its content is `option` elements — so
   * the own-text walk below returned an empty string for every one of them,
   * the keep-check then dropped the box entirely, and three cascading
   * dropdowns rendered as three blank rows with no clickable region anywhere
   * near them. An agent playing L39 could not see that a control existed, let
   * alone operate it. That is a broken channel rather than a hard level, and
   * a blind run found it in four wasted turns.
   *
   * Only the selected label. The full option list is what a person gets after
   * they open the thing, and handing it over unopened would turn every
   * "select your country" level into a lookup.
   */
  const selectText = (el: HTMLSelectElement): string => {
    const chosen = el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
    return (chosen?.textContent ?? "").replace(/\s+/g, " ").trim();
  };

  const zOf = (el: Element): number => {
    let z = 0;
    let node: Element | null = el;
    /* The effective stacking depth, near enough: the largest explicit z-index
       on the way up. A full stacking-context implementation would be more
       correct and would not change what any real level looks like. */
    while (node && node !== document.body) {
      const value = Number(getComputedStyle(node).zIndex);
      if (!Number.isNaN(value)) z = Math.max(z, value);
      node = node.parentElement;
    }
    return z;
  };

  /*
   * A list that continues past its own edge.
   *
   * The hit test above is right to withhold everything below the fold — a
   * player cannot read it either — but withholding it also removed the *cue*
   * that it exists. On screen a clipped list has a cut-off row or a scrollbar
   * and a person reads "there is more of this" instantly. A blind run lost L48
   * to the silence: "no scrollbar glyph, no ellipsis, no cue of any kind that
   * content existed below the fold", and only found the hidden checkbox by
   * guessing a scroll coordinate.
   *
   * So the fact is reported and nothing else is: that this area scrolls, and
   * which way there is more. Never how much, never what is in it.
   */
  const scrollNote = (
    el: Element,
    style: CSSStyleDeclaration,
  ): "above" | "below" | "both" | null => {
    const oy = style.overflowY;
    if (oy !== "auto" && oy !== "scroll") return null;
    const top = el.scrollTop > 2;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    if (top && bottom) return "both";
    if (top) return "above";
    if (bottom) return "below";
    return null;
  };

  const seen = new Set<Element>();

  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
    if (seen.has(el)) continue;

    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    /* Checked before `visible()`, because a scroll container is often an empty
       frame whose own centre is covered by the rows inside it — it would fail
       the hit test and take the cue down with it. The container is on screen
       whether or not anything is painted at its exact middle. */
    const more = scrollNote(el, style);
    if (more && rect.width > 40 && rect.height > 40) {
      boxes.push({
        text: "",
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        kind: "panel",
        more,
        ...centreOf(rect),
      });
    }

    if (!visible(el, style, rect)) continue;

    const tag = el.tagName.toLowerCase();
    let text = "";

    if (tag === "input" || tag === "textarea") {
      text = fieldText(el as HTMLInputElement);
    } else if (tag === "select") {
      text = selectText(el as HTMLSelectElement);
    } else {
      /* Own text only. Taking `textContent` from every ancestor would report
         the same sentence a dozen times, once per wrapper, each at a different
         rectangle. */
      text = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }

    const kind = kindOf(el, style);
    const opaque = isOpaque(style.backgroundColor);

    /* Keep it if it says something, if it is a solid panel that hides what is
       behind it, or if it is a drawing big enough that a person would notice
       it was there. Everything else is layout and the agent never hears of it.

       The size floor keeps the grid from filling up with icons: a 16px logo is
       not a thing anybody plays against, and a screen of `░` where the slop
       kit put decoration would be worse than the omission it fixes. */
    const drawn = kind === "drawing" && rect.width >= 24 && rect.height >= 24;

    /*
     * A control with no words on it is still a control.
     *
     * L05's six consent toggles are buttons whose only child is the knob, so
     * the own-text walk returns nothing and every one of them was thrown away
     * — leaving six category names with no switch anywhere near them. Two
     * blind runs died on that level in the same way, and the second one
     * guessed the truth without being able to act on it:
     *
     *   turn 6 · "Guessing the six category rows have toggle switches drawn
     *   off to the right past the visible text"
     *
     * They were exactly there, and they were pressable, and we had not
     * mentioned them. Same failure as the dropdowns: not a hard level, a level
     * with no legal move.
     *
     * The size floor is what stops this filling the grid with decoration.
     */
    const pressable = kind === "button" && rect.width >= 14 && rect.height >= 10;

    /* A dial's value almost always lives in a child element, so its own text
       is empty and the own-text rule would throw the whole control away —
       which is exactly what happened to the date wheels. Take the value from
       inside it, and swallow the parts below so one wheel is one region. */
    if (kind === "dial" && !text) {
      text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
      for (const child of Array.from(el.querySelectorAll("*"))) seen.add(child);
    }

    if (
      !text &&
      !drawn &&
      !pressable &&
      kind !== "dial" &&
      !(opaque && rect.width > view.width * 0.4 && rect.height > 40)
    ) {
      continue;
    }

    seen.add(el);

    /*
     * A control reported once, not once per part it is built from.
     *
     * A toggle switch is a button wrapping a knob, and the knob is itself
     * framed and carries a pointer cursor — so `kindOf` calls it a button too
     * and L05 came back with twelve overlapping regions for six switches. To
     * anybody looking at the screen there are six things there.
     *
     * Only for a control with no words of its own: a button whose child says
     * "Continue" already reports through that child's text, and swallowing
     * labelled descendants wholesale would lose text a person can plainly
     * read.
     */
    if (!text && kind === "button") {
      for (const child of Array.from(el.querySelectorAll("*"))) seen.add(child);
    }

    boxes.push({
      text,
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      kind,
      z: zOf(el),
      opaque,
      /*
       * Drawn faded.
       *
       * Measured off `opacity`, not off the `disabled` attribute, and the
       * distinction is the whole point: this reports how the control is
       * *painted*, so a `div` greyed out with a class reads exactly the same
       * as a real disabled button, and a control that is somehow disabled
       * without looking it stays silent. `visible()` has already rejected
       * anything under 0.05, so this band is the deliberately-faded one —
       * the slop kit greys an unavailable CTA to 0.4.
       */
      ...(Number(style.opacity) < 0.6 ? { dim: true } : {}),
      /*
       * The point we already proved is on this element.
       *
       * `visible()` hit-tested exactly here to decide the thing is on screen
       * at all, so it is the one coordinate in the box that is *known* to
       * belong to it. That matters for anything the page has rotated: under
       * the `Rotate` modifier a 400×44 input reports a 326×120 bounding box
       * whose corners are empty, and a click aimed at the corner hits the page
       * behind it. Carrying this through is what lets the region list publish
       * somewhere the mouse actually lands.
       */
      ...centreOf(rect),
    });
  }

  return {
    boxes,
    view,
    /* The tally screen. The only structural fact the harness is told, and it is
       about the run rather than about the page. */
    finished: document.querySelector("[data-testid='final-score']") !== null,
  };
}
