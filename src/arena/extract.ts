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
  const hitTested = (el: Element, rect: DOMRect): boolean => {
    const cx = Math.min(view.width - 1, Math.max(0, rect.left + rect.width / 2));
    const cy = Math.min(view.height - 1, Math.max(0, rect.top + rect.height / 2));
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

  const seen = new Set<Element>();

  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
    if (seen.has(el)) continue;

    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
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

    if (
      !text &&
      !drawn &&
      !pressable &&
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
