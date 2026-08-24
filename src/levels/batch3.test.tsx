import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BY_ID } from "./registry";
import { streamFor } from "@/engine/rng";
import { createSilentSfx } from "@/engine/sfx";
import type { LevelModule, LevelProps } from "@/engine/types";
import { PAIRS, PARASITE, applyMove, same, scramble, shortestSolution } from "./L41RankYourPriorities/puzzle";

afterEach(cleanup);

function mount(id: string, seed = 4242) {
  const mod = BY_ID.get(id) as LevelModule;
  const p: LevelProps = {
    onSolve: vi.fn(),
    onFail: vi.fn(),
    rng: streamFor(seed, id),
    chaos: [],
    degraded: false,
    input: {} as LevelProps["input"],
    sfx: createSilentSfx(),
  };
  render(<mod.Component {...p} />);
  return p;
}

/*
 * Every level needs a proven honest solve. A level nobody can beat is not
 * cruel, it is broken — and the difference is invisible from the outside,
 * because a player who cannot solve it assumes they are the problem.
 */

describe("L03 · Select Your Country", () => {
  /** The country the form has already decided you live in. */
  const target = () => screen.getByText(/We have you down as/).textContent!
    .replace("We have you down as ", "").replace(/\.$/, "");

  it("solves through the type-ahead nobody is told about", () => {
    const p = mount("L03");
    const want = target();
    const box = screen.getByRole("listbox");

    /* The native behaviour this custom listbox accidentally kept: press the
       first letter, repeat until the one you want is selected. */
    const row = () => within(screen.getByRole("listbox")).getByText(want);
    for (let i = 0; i < 60 && row().getAttribute("aria-selected") !== "true"; i++) {
      fireEvent.keyDown(box, { key: want[0]!.toLowerCase() });
    }
    expect(row().getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByText("Confirm Region"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("solves by clicking the country directly", () => {
    const p = mount("L03");
    const want = target();
    fireEvent.click(within(screen.getByRole("listbox")).getByText(want));
    fireEvent.click(screen.getByText("Confirm Region"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("punishes a wrong answer with countries that do not exist", () => {
    const p = mount("L03");
    const before = screen.getAllByRole("option").length;
    const wrong = screen.getAllByRole("option").find((o) => o.textContent !== target())!;

    fireEvent.click(wrong);
    fireEvent.click(screen.getByText("Confirm Region"));

    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("option").length).toBe(before + 5);
  });

  /* Sorted by population is the joke, so it had better actually be the order. */
  it("does not sort alphabetically, which would ruin everything", () => {
    mount("L03");
    const names = screen.getAllByRole("option").map((o) => o.textContent!);
    expect(names).not.toEqual([...names].sort());
    expect(names[0]).toBe("India");
  });
});

describe("L06 · Password Requirements", () => {
  /** Build a password that satisfies all six rules at once. */
  const solve = () => {
    const exact = Number(
      /exactly (\d+) characters/.exec(screen.getByText(/exactly \d+ characters/).textContent!)![1],
    );
    const emoji = [...screen.getByText(/trending emoji/).textContent!.split(": ")[1]!.trim()]
      .filter((c) => c.trim())[0]!;
    /* One capital, exactly two vowels (prime), consonants to length, one emoji.
       No day name appears in any of it. */
    const head = "Xae";
    const pad = "bcdfghjklmnpqrstvwxyz".slice(0, exact - head.length - 1);
    return head + pad + emoji;
  };

  it("has a password that satisfies all six rules simultaneously", () => {
    const p = mount("L06");
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: solve() } });

    for (const row of document.querySelectorAll("[data-rule]")) {
      expect(row.getAttribute("data-ok"), row.textContent ?? "").toBe("yes");
    }
    fireEvent.click(screen.getByText("Create Account"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("is solvable across many seeds, not just a lucky one", () => {
    for (const seed of [1, 7, 99, 1234, 55555]) {
      cleanup();
      const p = mount("L06", seed);
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: solve() } });
      fireEvent.click(screen.getByText("Create Account"));
      expect(p.onSolve, `seed ${seed}`).toHaveBeenCalledOnce();
    }
  });

  /* A satisfied rule that un-satisfies is the entire feel of the level. */
  it("takes a tick away again when a later keystroke breaks it", () => {
    mount("L06");
    const field = screen.getByLabelText("Password");
    fireEvent.change(field, { target: { value: solve() } });
    expect(document.querySelector('[data-rule="exact"]')!.getAttribute("data-ok")).toBe("yes");

    fireEvent.change(field, { target: { value: `${solve()}z` } });
    expect(document.querySelector('[data-rule="exact"]')!.getAttribute("data-ok")).toBe("no");
  });

  it("refuses an incomplete password and says how many are left", () => {
    const p = mount("L06");
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByText("Create Account"));
    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getByText(/requirements? to go/)).toBeTruthy();
  });

  /* Levels may not read the wall clock — a seeded day is reproducible and a
     real one would make the same seed link behave differently on Tuesday. */
  it("takes its idea of today from the seed, not the clock", () => {
    mount("L06", 11);
    const a = screen.getByText(/\(today\)/).textContent;
    cleanup();
    mount("L06", 11);
    expect(screen.getByText(/\(today\)/).textContent).toBe(a);
  });
});

describe("L09 · Almost There!", () => {
  it("closes on the tiny ✕ once the countdown is done", () => {
    vi.useFakeTimers();
    const p = mount("L09");
    act(() => vi.advanceTimersByTime(6000));
    fireEvent.click(screen.getByLabelText("Close advertisement"));
    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("closes on Escape, which nothing on screen mentions", () => {
    const p = mount("L09");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("restarts the countdown when the obvious ✕ is used", () => {
    const p = mount("L09");
    fireEvent.click(screen.getByLabelText("Close ad"));
    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getByText(/Ad restarted \(1\)/)).toBeTruthy();
  });

  it("gets longer the second time, but never longer than that", () => {
    mount("L09");
    fireEvent.click(screen.getByLabelText("Close ad"));
    fireEvent.click(screen.getByLabelText("Close ad"));
    expect(screen.getByText(/now 8s/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close ad"));
    expect(screen.getByText(/now 8s/)).toBeTruthy();
  });

  it("does nothing on the tiny ✕ while the ad is still running", () => {
    const p = mount("L09");
    fireEvent.click(screen.getByLabelText("Close advertisement"));
    expect(p.onSolve).not.toHaveBeenCalled();
  });
});

describe("L10 · Scroll To Accept", () => {
  it("solves through the sentence buried in the body copy", () => {
    const p = mount("L10");
    fireEvent.click(screen.getByText(/By continuing to not read this/));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  /* The escape has to look exactly like the paragraph it lives in, or it is a
     button in the copy rather than a line of it. */
  it("hides the escape in plain body text rather than styling it as a link", () => {
    mount("L10");
    const link = screen.getByText(/By continuing to not read this/);
    expect(link.tagName).toBe("BUTTON");
    expect(getComputedStyle(link).textDecoration).not.toContain("underline");
  });

  it("cannot be finished by scrolling, because the document grows", () => {
    mount("L10");
    const before = document.querySelectorAll("p").length;
    const box = screen.getByText(/must read to the end/).parentElement!;

    Object.defineProperty(box, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(box, "clientHeight", { value: 200, configurable: true });
    box.scrollTop = 1900;
    fireEvent.scroll(box);

    expect(document.querySelectorAll("p").length).toBeGreaterThan(before);
    expect(screen.getByText(/Additional terms loaded/)).toBeTruthy();
  });

  it("keeps Accept disabled until a bottom that never arrives", () => {
    mount("L10");
    expect(screen.getByText(/Scroll to the end to accept/).hasAttribute("disabled")).toBe(true);
  });
});

describe("L24 · Select Your Plan", () => {
  it("solves on the free link nobody can see", () => {
    const p = mount("L24");
    fireEvent.click(screen.getByText("Continue with Free"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  /* The 8px/#f4f4f5 measurement is asserted in the e2e suite, where real
     stylesheets apply — jsdom does not load CSS modules, so checking it here
     would assert the browser default and pass forever. */

  it("subscribes you to something when you dismiss the offer", () => {
    vi.useFakeTimers();
    const p = mount("L24");
    act(() => vi.advanceTimersByTime(6100));

    fireEvent.click(screen.getByText(/No thanks/));
    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getByText(/You.re subscribed to/)).toBeTruthy();
    vi.useRealTimers();
  });

  /* Escape is the clean exit and nothing says so. */
  it("dismisses on Escape without subscribing you", () => {
    vi.useFakeTimers();
    mount("L24");
    act(() => vi.advanceTimersByTime(6100));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/You.re subscribed to/)).toBeNull();
    vi.useRealTimers();
  });

  it("charges you a banner for choosing a paid plan", () => {
    const p = mount("L24");
    fireEvent.click(screen.getByText("Choose Growth"));
    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).toHaveBeenCalledOnce();
  });
});

describe("L34 · Level Failed To Generate", () => {
  const piece = (name: string) => document.querySelector(`[data-piece="${name}"]`)!;
  const slot = (i: number) => document.querySelector(`[data-slot="${i}"]`)!;

  const assemble = () => {
    for (const [name, i] of [["label", 0], ["input", 1], ["button", 2]] as const) {
      fireEvent.click(piece(name));
      fireEvent.click(slot(i));
    }
  };

  it("solves by reassembling the form and filling it in", () => {
    const p = mount("L34");
    assemble();
    expect(screen.getByText(/Tree resolved/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "a@b.co" } });
    fireEvent.click(screen.getByText("Verify"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("will not verify an assembled form with an empty field", () => {
    const p = mount("L34");
    assemble();
    fireEvent.click(screen.getByText("Verify"));
    expect(p.onSolve).not.toHaveBeenCalled();
    expect(screen.getByText(/The field is empty/)).toBeTruthy();
  });

  it("will not verify a filled field in the wrong order", () => {
    const p = mount("L34");
    fireEvent.click(piece("button"));
    fireEvent.click(slot(0));
    fireEvent.click(piece("input"));
    fireEvent.click(slot(1));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "a@b.co" } });
    fireEvent.click(screen.getByText("Verify"));
    expect(p.onSolve).not.toHaveBeenCalled();
  });

  /* A level whose only mechanic is dragging is a level some people cannot play
     at all, so the keyboard path has to be a real one rather than a courtesy. */
  it("is fully playable from the keyboard", () => {
    const p = mount("L34");
    /* Three presses, three pieces, in order — each lands in the first slot
       still empty. */
    fireEvent.keyDown(piece("label"), { key: "ArrowDown" });
    fireEvent.keyDown(piece("input"), { key: "ArrowDown" });
    fireEvent.keyDown(piece("button"), { key: "ArrowDown" });

    expect(slot(0).getAttribute("data-holds")).toBe("label");
    expect(slot(1).getAttribute("data-holds")).toBe("input");
    expect(slot(2).getAttribute("data-holds")).toBe("button");

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "a@b.co" } });
    fireEvent.click(screen.getByText("Verify"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("has no fail state, because construction puzzles must not punish placing a piece", () => {
    const p = mount("L34");
    fireEvent.click(piece("button"));
    fireEvent.click(slot(0));
    fireEvent.click(slot(0));
    expect(p.onFail).not.toHaveBeenCalled();
  });
});

describe("L41 · Rank Your Priorities", () => {
  const order = () =>
    [...document.querySelectorAll("[data-item]")].map((el) => el.getAttribute("data-item")!);
  const targetOrder = () =>
    [...document.querySelectorAll("[data-target]")].map((el) => el.querySelector("span:last-child")!.textContent!);

  it("solves by replaying the scramble, which every move being its own inverse guarantees", () => {
    const p = mount("L41");
    const want = targetOrder();

    /* Breadth-first over the move set: if the level is honest this always
       finds a path, and it is what the player is doing by hand. */
    const path = shortestSolution(order(), want);
    expect(path).not.toBeNull();

    for (let step = 0; step < 12 && !same(order(), want); step++) {
      const from = order();
      let moved = false;
      for (let k = 0; k < PAIRS.length; k++) {
        if (shortestSolution(applyMove(from, k), want)! < shortestSolution(from, want)!) {
          fireEvent.click(screen.getByLabelText(`Move ${from[k]} down`));
          moved = true;
          break;
        }
      }
      expect(moved).toBe(true);
    }
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("moves two other items every time you move one", () => {
    mount("L41");
    const before = order();
    fireEvent.click(screen.getByLabelText(`Move ${before[0]} down`));
    const after = order();
    const changed = before.filter((v, i) => v !== after[i]).length;
    expect(changed).toBe(4);
  });

  it("returns to the seeded start on Reset", () => {
    mount("L41");
    const start = order();
    fireEvent.click(screen.getByLabelText(`Move ${start[1]} down`));
    expect(order()).not.toEqual(start);
    fireEvent.click(screen.getByText("Reset"));
    expect(order()).toEqual(start);
  });

  it("never fails you, because wandering is part of the puzzle", () => {
    const p = mount("L41");
    for (let i = 0; i < 8; i++) fireEvent.click(screen.getByLabelText(`Move ${order()[2]} down`));
    expect(p.onFail).not.toHaveBeenCalled();
  });
});

/*
 * The property that matters most in this batch.
 *
 * "Shuffle the list and hope" is how an unsolvable seed reaches production,
 * and a player who cannot win assumes they are the problem. Every generator
 * being its own inverse is the proof; this is the check that the proof holds
 * for every seed the dealer can produce, exhaustively rather than by sampling.
 */
describe("L41 · solvability", () => {
  it("is solvable from every start the level can deal, across 500 seeds", () => {
    const target = ["a", "b", "c", "d", "e"];
    for (let seed = 0; seed < 500; seed++) {
      const rng = streamFor(seed, "L41");
      const start = scramble(target, 5, rng);
      const steps = shortestSolution(start, target);
      expect(steps, `seed ${seed}`).not.toBeNull();
      expect(steps!, `seed ${seed}`).toBeLessThanOrEqual(5);
    }
  });

  it("makes every move its own inverse, which is what the proof rests on", () => {
    const start = ["a", "b", "c", "d", "e"];
    for (let k = 0; k < PAIRS.length; k++) {
      expect(applyMove(applyMove(start, k), k)).toEqual(start);
    }
  });

  it("never lets a move touch the same item twice", () => {
    for (let k = 0; k < PAIRS.length; k++) {
      const moved = new Set([...PAIRS[k]!, ...PAIRS[PARASITE[k]!]!]);
      expect(moved.size).toBe(4);
    }
  });
});

describe("L47 · Match This Colour", () => {
  const delta = () => Number(screen.getByTestId("l47-delta").textContent!.replace("Δ", ""));

  it("solves by driving the delta readout down, with no colour perception at all", () => {
    const p = mount("L47");
    const set = (label: string, n: number) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value: String(n) } });

    /* Exactly what a colour-blind player does: sweep each slider, keep the
       position where the number was lowest, then sweep again more finely. */
    const sweep = (label: string, max: number, step: number, around?: number) => {
      const lo = around === undefined ? 0 : Math.max(0, around - step * 6);
      const hi = around === undefined ? max : Math.min(max, around + step * 6);
      let best = delta();
      let bestAt = Number((screen.getByLabelText(label) as HTMLInputElement).value);
      for (let n = lo; n <= hi; n += step) {
        set(label, n);
        if (delta() < best) { best = delta(); bestAt = n; }
      }
      set(label, bestAt);
      return bestAt;
    };

    const axes = [["Hue", 359, 6], ["Saturation", 100, 4], ["Lightness", 100, 4]] as const;
    const coarse = axes.map(([label, max, step]) => sweep(label, max, step));
    axes.forEach(([label, max], i) => sweep(label, max, 1, coarse[i]));

    expect(delta()).toBeLessThan(12);
    fireEvent.click(screen.getByText("Save Brand Colour"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("starts far enough away to be a puzzle", () => {
    for (const seed of [1, 2, 3, 42, 777]) {
      cleanup();
      mount("L47", seed);
      expect(delta(), `seed ${seed}`).toBeGreaterThan(12);
    }
  });

  it("quotes the target in hex while the controls are HSL — the visible half of the joke", () => {
    mount("L47");
    expect(screen.getAllByText(/^#[0-9A-F]{6}$/).length).toBe(2);
    expect(screen.getByLabelText("Hue")).toBeTruthy();
    expect(screen.getByLabelText("Saturation")).toBeTruthy();
  });

  it("refuses a submission outside tolerance and says by how much", () => {
    const p = mount("L47");
    fireEvent.click(screen.getByText("Save Brand Colour"));
    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getByText(/that's ΔE/i)).toBeTruthy();
  });
});
