import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BY_ID } from "./registry";
import { streamFor } from "@/engine/rng";
import { createSilentSfx } from "@/engine/sfx";
import type { LevelModule, LevelProps } from "@/engine/types";

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

describe("L31 · Mirror", () => {
  it("is an ordinary login that solves by filling it in", () => {
    const p = mount("L31");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByText("Sign in"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("has no fail state — it is a motor challenge, not a puzzle", () => {
    const p = mount("L31");
    fireEvent.click(screen.getByText("Sign in"));
    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).not.toHaveBeenCalled();
  });

  /* The mirror is the level. Flipping the container rather than the text is
     what makes hit areas flip too — anything less is a drawing of the joke. */
  it("mirrors the whole card, so hit areas move with the pixels", () => {
    mount("L31");
    const flipped = document.querySelector('[class*="flip"]');
    expect(flipped).toBeTruthy();
    expect(flipped!.contains(screen.getByText("Sign in"))).toBe(true);
  });
});

describe("L32 · Network Conditions", () => {
  it("lands every keystroke, just late — patience is the solve", () => {
    vi.useFakeTimers();
    const p = mount("L32");

    for (const label of ["Full name", "Company", "Role", "Team size"]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: "x" } });
    }
    /* Nothing has arrived yet. That gap is the entire level. */
    expect(screen.queryByText(/saved: x/)).toBeNull();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getAllByText(/saved: x/).length).toBe(4);

    fireEvent.click(screen.getByText("Continue"));
    act(() => vi.advanceTimersByTime(1000));
    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("refuses an incomplete form, also late", () => {
    vi.useFakeTimers();
    const p = mount("L32");
    fireEvent.click(screen.getByText("Continue"));
    act(() => vi.advanceTimersByTime(1000));
    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getByText(/4 fields still empty/)).toBeTruthy();
    vi.useRealTimers();
  });

  /* A level that dropped input would be broken rather than slow, and the
     difference is the whole point: this has to be survivable by waiting. */
  it("never drops a keystroke, however fast they arrive", () => {
    vi.useFakeTimers();
    mount("L32");
    const field = screen.getByLabelText("Full name");
    for (const v of ["a", "ab", "abc", "abcd"]) {
      fireEvent.change(field, { target: { value: v } });
    }
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("saved: abcd")).toBeTruthy();
    vi.useRealTimers();
  });
});

describe("L33 · This Page Is Rotating", () => {
  const wanted = () => {
    const text = screen.getByText(/card ending/).textContent!;
    const [, last4, month] = /card ending (\d{4}), expiring (\d{2})/.exec(text)!;
    return { last4: last4!, month: month! };
  };

  it("solves by re-entering what the card says", () => {
    const p = mount("L33");
    const want = wanted();
    fireEvent.change(screen.getByLabelText("Last four digits"), { target: { value: want.last4 } });
    fireEvent.change(screen.getByLabelText("Expiry month"), { target: { value: want.month } });
    fireEvent.click(screen.getByText("Pay Now"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("rejects the wrong card and clears the digits", () => {
    const p = mount("L33");
    fireEvent.change(screen.getByLabelText("Last four digits"), { target: { value: "0000" } });
    fireEvent.click(screen.getByText("Pay Now"));
    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).toHaveBeenCalledOnce();
    expect((screen.getByLabelText("Last four digits") as HTMLInputElement).value).toBe("");
  });
});

describe("L23 · AI Is Generating Your Code", () => {
  /* The citation footer is the honest solve: one of the three streamed codes
     appears in it, and that one is real. */
  const cited = () =>
    /account\.session\[(\d{6})\]/.exec(screen.getByTestId("l23-sources").textContent!)![1]!;

  it("solves on the code the sources line cites", () => {
    const p = mount("L23");
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: cited() } });
    fireEvent.click(screen.getByText("Verify"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("apologises and re-rolls when you trust the bubble instead", () => {
    const p = mount("L23");
    const before = cited();
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByText("Verify"));

    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getByText(/absolutely right|Good catch|My mistake/)).toBeTruthy();
    expect(cited()).not.toBe(before);
  });

  /* Regenerating is the trap: it really does regenerate, which is what makes
     it cost you the clock instead of helping. */
  it("re-rolls everything when regenerated, answer included", () => {
    mount("L23");
    const before = cited();
    fireEvent.click(screen.getByText(/Regenerate response/));
    expect(cited()).not.toBe(before);
  });

  it("is still solvable after a regeneration", () => {
    const p = mount("L23");
    fireEvent.click(screen.getByText(/Regenerate response/));
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: cited() } });
    fireEvent.click(screen.getByText("Verify"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("cites a code that the assistant actually said", () => {
    for (const seed of [1, 2, 3, 99, 4242]) {
      cleanup();
      mount("L23", seed);
      /* The stream types in over time; the full text is what matters. */
      expect(cited(), `seed ${seed}`).toMatch(/^\d{6}$/);
    }
  });
});

describe("L25 · Two Cursors", () => {
  const value = (id: string) =>
    document.querySelector(`[data-field="${id}"]`)!.textContent!;

  it("fills the field you aimed at when the real cursor is yours", () => {
    const p = mount("L25");
    /* Whichever cursor starts real, one of the first two clicks lands. */
    fireEvent.click(screen.getByLabelText("Preferred name: Yes"));
    const landed = value("a") === "Yes";
    if (!landed) expect(p.onFail).toHaveBeenCalled();
    else expect(p.onFail).not.toHaveBeenCalled();
  });

  it("is completable, and only counts real answers", () => {
    vi.useFakeTimers();
    const p = mount("L25");

    /* Exactly the honest strategy: click, and if the decoy got it, wait for
       the swap and go again. Terminates because the swap is on a timer. */
    for (let attempt = 0; attempt < 12; attempt++) {
      for (const [id, label] of [
        ["a", "Preferred name"], ["b", "Time zone"], ["c", "How did you hear about us?"],
      ] as const) {
        if (value(id) === "Yes") continue;
        fireEvent.click(screen.getByLabelText(`${label}: Yes`));
      }
      if (["a", "b", "c"].every((id) => value(id) === "Yes")) break;
      act(() => vi.advanceTimersByTime(5100));
    }

    expect(["a", "b", "c"].map(value)).toEqual(["Yes", "Yes", "Yes"]);
    fireEvent.click(screen.getByText("Save profile"));
    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  /* Garbage in a field is a setback, not a death. A level whose failure state
     is unrecoverable would be a different and much worse level. */
  it("always offers a way back from a field full of garbage", () => {
    mount("L25");
    fireEvent.click(screen.getByLabelText("Preferred name: Yes"));
    fireEvent.click(screen.getByText("Clear"));
    expect(["a", "b", "c"].map(value)).toEqual(["—", "—", "—"]);
  });

  it("will not save a form the decoy filled in", () => {
    const p = mount("L25");
    fireEvent.click(screen.getByText("Answer all three"));
    expect(p.onSolve).not.toHaveBeenCalled();
  });
});

describe("L49 · Careers, the level that is not in the index", () => {
  const pick = (question: string, option: string) =>
    fireEvent.click(
      screen.getByText(option, { selector: `[data-question="${question}"] button` }),
    );

  it("hires you for knowing what the game spent five minutes teaching", () => {
    const p = mount("L49");
    pick("dialog", "The red one on the right");
    pick("terms", "Read the body text and find the line that says they already agreed");
    pick("pricing", "Eight grey pixels below the fold");
    fireEvent.click(screen.getByText("Submit application"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("explains every answer, right or wrong, rather than just scoring you", () => {
    const p = mount("L49");
    pick("dialog", "The green one on the left");
    pick("terms", "Keep scrolling; it must end eventually");
    pick("pricing", "Eight grey pixels below the fold");
    fireEvent.click(screen.getByText("Submit application"));

    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getByText(/The colour is decoration/)).toBeTruthy();
    expect(screen.getByText(/It never ends/)).toBeTruthy();
    expect(screen.getByText(/1 of 3/)).toBeTruthy();
  });

  it("will not submit until all three are answered", () => {
    const p = mount("L49");
    pick("dialog", "The red one on the right");
    fireEvent.click(screen.getByText("Answer all three"));
    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).not.toHaveBeenCalled();
  });

  it("is honest — no gradient, no badge, like the only other level that is", () => {
    mount("L49");
    expect(document.querySelector('[class*="plain"]')).toBeTruthy();
    expect(screen.getByText(/There is no company/)).toBeTruthy();
  });
});
