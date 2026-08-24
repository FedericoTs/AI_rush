import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { afterEach } from "vitest";
import { REGISTRY, BY_ID } from "./registry";
import { streamFor } from "@/engine/rng";
import { createSilentSfx } from "@/engine/sfx";
import { MODIFIERS } from "@/engine/chaos/modifiers";
import type { LevelModule, LevelProps } from "@/engine/types";

afterEach(cleanup);

function props(overrides: Partial<LevelProps> = {}): LevelProps {
  return {
    onSolve: vi.fn(),
    onFail: vi.fn(),
    rng: streamFor(1234, "test"),
    chaos: [],
    degraded: false,
    input: {} as LevelProps["input"],
    sfx: createSilentSfx(),
    ...overrides,
  };
}

const mount = (mod: LevelModule, over: Partial<LevelProps> = {}) => {
  const p = props(over);
  render(<mod.Component {...p} />);
  return p;
};

describe("the registry", () => {
  it("has no duplicate ids or slugs — seeds reference them forever", () => {
    const ids = REGISTRY.map((m) => m.meta.id);
    const slugs = REGISTRY.map((m) => m.meta.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("declares only real modifiers as incompatible", () => {
    for (const m of REGISTRY) {
      for (const id of m.meta.incompatibleModifiers) expect(MODIFIERS[id]).toBeTruthy();
    }
  });

  it("gives every level a par a human could actually hit", () => {
    for (const m of REGISTRY) {
      expect(m.meta.parSeconds).toBeGreaterThan(0);
      expect(m.meta.parSeconds).toBeLessThanOrEqual(45);
    }
  });

  it("ships a fallback for anything requiring a sensor", () => {
    for (const m of REGISTRY) {
      const sensor = m.meta.requires.some((r) => ["motion", "audioIn", "camera", "haptics"].includes(r));
      if (sensor) expect(m.Fallback).toBeTruthy();
    }
  });

  it("mounts every level without throwing", () => {
    for (const m of REGISTRY) {
      const { unmount } = render(<m.Component {...props()} />);
      unmount();
    }
  });
});

describe("L01 · Continue To Your Account", () => {
  it("solves on the red button", () => {
    const p = mount(BY_ID.get("L01")!);
    fireEvent.click(screen.getByText("⚠ Continue"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("fails on Cancel, then shows the sane arrangement", () => {
    const p = mount(BY_ID.get("L01")!);
    fireEvent.click(screen.getByText("Cancel"));
    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getByText("Continue")).toBeTruthy(); // no warning triangle
  });

  it("swaps back after 400ms, once you have committed", () => {
    vi.useFakeTimers();
    mount(BY_ID.get("L01")!);
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByText("Continue")).toBeTruthy();
    act(() => vi.advanceTimersByTime(450));
    expect(screen.getByText("⚠ Continue")).toBeTruthy();
    vi.useRealTimers();
  });
});

describe("L02 · One-Time Passcode", () => {
  const cell = (i: number) => screen.getByTestId(`otp-cell-${i}`);
  const typeInto = (i: number, text: string) => {
    fireEvent.click(cell(i));
    const input = screen.getByLabelText("One-time passcode") as HTMLInputElement;
    input.value = text;
    fireEvent.input(input);
  };

  it("stuffs the whole code into one cell, and rejects it", () => {
    const p = mount(BY_ID.get("L02")!);
    typeInto(0, "481516");

    /* The literally correct string, in the wrong shape. The form does not notice. */
    expect(cell(0).textContent).toBe("481516");
    fireEvent.click(screen.getByText("Verify"));
    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getByText(/Invalid code/)).toBeTruthy();
  });

  it("solves one digit per cell", () => {
    const p = mount(BY_ID.get("L02")!);
    for (let i = 0; i < 6; i++) typeInto(i, "481516"[i]!);
    for (let i = 0; i < 6; i++) expect(cell(i).textContent).toBe("481516"[i]);
    fireEvent.click(screen.getByText("Verify"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });
});

describe("L36 · Sign In", () => {
  it("solves on a plausible email and a long enough password", () => {
    const p = mount(BY_ID.get("L36")!);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter22" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  /* The level's whole premise. Any punishment feedback here would be a tell. */
  it("never calls onFail — a validation message is not a failure", () => {
    const p = mount(BY_ID.get("L36")!);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(p.onFail).not.toHaveBeenCalled();
    expect(screen.getByText("Email address is required.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "nonsense" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(p.onFail).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
  });

  it("reveals the password for real", () => {
    mount(BY_ID.get("L36")!);
    const pw = screen.getByLabelText("Password") as HTMLInputElement;
    expect(pw.type).toBe("password");
    fireEvent.click(screen.getByLabelText("Show password"));
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("text");
  });

  it("refuses every modifier, because a modifier would be a tell", () => {
    const l36 = BY_ID.get("L36")!;
    expect(l36.meta.incompatibleModifiers).toHaveLength(Object.keys(MODIFIERS).length);
  });
});

describe("L37 · Set Your Security PIN", () => {
  const dialValue = (i: number) =>
    Number(document.querySelectorAll("[role='spinbutton']")[i]!.getAttribute("aria-valuenow"));

  it("turns every dial to the right of the one you touch", () => {
    mount(BY_ID.get("L37")!);
    const before = [0, 1, 2, 3].map(dialValue);
    fireEvent.click(screen.getByLabelText("Dial 2 up"));
    const after = [0, 1, 2, 3].map(dialValue);

    expect(after[0]).toBe(before[0]);                 // untouched to the left
    expect(after[1]).toBe((before[1]! + 1) % 10);
    expect(after[2]).toBe((before[2]! + 1) % 10);
    expect(after[3]).toBe((before[3]! + 1) % 10);
  });

  it("solves left to right, each placement final", () => {
    const p = mount(BY_ID.get("L37")!);
    const target = [4, 7, 2, 9];
    for (let i = 0; i < 4; i++) {
      const label = screen.getByLabelText(`Dial ${i + 1} up`);
      for (let turns = 0; turns < 10 && dialValue(i) !== target[i]; turns++) fireEvent.click(label);
      expect(dialValue(i)).toBe(target[i]);
    }
    fireEvent.click(screen.getByText("Confirm PIN"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("re-seeds the dials on a wrong PIN", () => {
    const p = mount(BY_ID.get("L37")!);
    const before = [0, 1, 2, 3].map(dialValue).join("");
    fireEvent.click(screen.getByText("Confirm PIN"));
    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getByText(/re-seeded/)).toBeTruthy();
    expect([0, 1, 2, 3].map(dialValue).join("")).not.toBe("4729");
    void before;
  });
});

/**
 * A convincing form is convincing to a password manager too.
 *
 * Pillar P1 asks every level to look like a genuine interface for the first
 * second and a half, and four of them achieve that by being a sign-in page or
 * a checkout. That is the joke, and it is the one place the joke can cost a
 * player something real: somebody two minutes into a five-minute panic types a
 * real address without thinking, and a browser offers to remember it.
 *
 * `meta.collects` is what makes the chrome show a notice. These render every
 * level and fail if one grows a credential or card field without declaring it,
 * so the notice cannot be quietly forgotten on the next one.
 */
describe("levels that ask for something real", () => {
  const SENSITIVE_LABEL =
    /e-?mail|password|card|cvv|cvc|expiry|last four|sort code|iban|account number/i;

  function fields(mod: LevelModule): HTMLInputElement[] {
    cleanup();
    mount(mod);
    return Array.from(document.querySelectorAll("input"));
  }

  function looksSensitive(mod: LevelModule): boolean {
    for (const el of fields(mod)) {
      if (el.type === "password" || el.type === "email") return true;
      const described = `${el.getAttribute("aria-label") ?? ""} ${el.placeholder} ${
        document.querySelector(`label[for="${el.id}"]`)?.textContent ?? ""
      }`;
      if (SENSITIVE_LABEL.test(described)) return true;
    }
    return false;
  }

  it("declares `collects`, so the chrome can say nothing is real", () => {
    const undeclared: string[] = [];
    for (const mod of REGISTRY) {
      if (looksSensitive(mod) && !mod.meta.collects) undeclared.push(mod.meta.id);
    }
    expect(undeclared, "these ask for a credential or card and say nothing").toEqual([]);
  });

  /*
   * The sharpest edge, and the one that was actually wrong.
   *
   * L36 shipped with `autoComplete="username"` and `current-password` — the
   * exact hints that make a manager fill a real credential into a game and
   * then offer to save it. No level may ask for that.
   */
  it("never invites a password manager to fill or save a real credential", () => {
    const INVITING = new Set(["username", "email", "current-password", "tel", "cc-number", "cc-csc"]);
    const offenders: string[] = [];

    for (const mod of REGISTRY) {
      for (const el of fields(mod)) {
        const hint = (el.getAttribute("autocomplete") ?? "").toLowerCase();
        if (INVITING.has(hint)) offenders.push(`${mod.meta.id}:${hint}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("only claims to collect things it actually asks for", () => {
    for (const mod of REGISTRY) {
      if (!mod.meta.collects) continue;
      expect(mod.meta.collects.length, `${mod.meta.id} declares an empty list`).toBeGreaterThan(0);
      expect(looksSensitive(mod), `${mod.meta.id} declares collects but has no such field`).toBe(true);
    }
  });
});

/**
 * The fifteen built in Phase 5.
 *
 * Each of these asserts the level's *honest solve* — the route `LEVELS.md`
 * promises a player can find. A level whose advertised escape does not actually
 * work is not a hard level, it is a broken one, and that is the single worst
 * thing this game can ship.
 */

describe("L07 · Just Checking You're Human", () => {
  it("stops the shuffle on a long press, which is the undocumented escape", () => {
    vi.useFakeTimers();
    mount(BY_ID.get("L07")!);
    const grid = screen.getByTestId("captcha-grid");
    expect(grid.getAttribute("data-held")).toBe("no");

    fireEvent.pointerDown(grid);
    act(() => vi.advanceTimersByTime(600));
    expect(grid.getAttribute("data-held")).toBe("yes");

    /* Held means held: the tiles stop moving. */
    const before = grid.textContent;
    act(() => vi.advanceTimersByTime(3000));
    expect(grid.textContent).toBe(before);
    vi.useRealTimers();
  });

  it("validates against what the cells hold now, not what they held when picked", () => {
    vi.useFakeTimers();
    const p = mount(BY_ID.get("L07")!);
    const grid = screen.getByTestId("captcha-grid");
    fireEvent.pointerDown(grid);
    act(() => vi.advanceTimersByTime(600)); // freeze it so the test is deterministic

    const cells = Array.from(grid.querySelectorAll("button"));
    cells.forEach((c, i) => {
      if (c.textContent?.includes("🚦")) fireEvent.click(screen.getByTestId(`cell-${i}`));
    });
    fireEvent.click(screen.getByText("Verify"));
    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe("L08 · Your Date Of Birth", () => {
  it("steps a wheel exactly one notch from the keyboard", () => {
    mount(BY_ID.get("L08")!);
    const day = screen.getByTestId("wheel-day");
    const before = Number(day.getAttribute("aria-valuenow"));
    fireEvent.keyDown(day, { key: "ArrowUp" });
    const after = Number(screen.getByTestId("wheel-day").getAttribute("aria-valuenow"));
    expect(after).toBe(before === 31 ? 1 : before + 1);
  });

  it("solves once all three wheels are on the date on file", () => {
    const p = mount(BY_ID.get("L08")!);
    const set = (key: string, want: number, max: number) => {
      for (let i = 0; i < max + 1; i++) {
        const el = screen.getByTestId(`wheel-${key}`);
        if (Number(el.getAttribute("aria-valuenow")) === want) return;
        fireEvent.keyDown(el, { key: "ArrowUp" });
      }
    };
    set("day", 14, 31);
    set("month", 6, 12);
    set("year", 1988, 200);
    fireEvent.click(screen.getByText("Confirm Date Of Birth"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });
});

describe("L15 · Type Your Full Name", () => {
  it("corrects only the last word, which is what makes the decoy trick work", async () => {
    const { correct } = await import("./L15TypeYourFullName");
    /* The real word is shielded because something else is now last. */
    expect(correct("Beatrix Wolstenholme")).toBe("Beatrix Wholesomeness");
    expect(correct("Beatrix Wolstenholme zz")).toBe("Beatrix Wolstenholme zz");
  });

  it("outruns the corrector if you never stop typing", () => {
    vi.useFakeTimers();
    const p = mount(BY_ID.get("L15")!);
    const field = screen.getByTestId("name-field");
    fireEvent.change(field, { target: { value: "Beatrix Wolstenholme" } });
    /* Submitted before the 300ms idle timer fires. */
    fireEvent.click(screen.getByText("Continue"));
    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("pounces if you pause", () => {
    vi.useFakeTimers();
    mount(BY_ID.get("L15")!);
    fireEvent.change(screen.getByTestId("name-field"), { target: { value: "Beatrix" } });
    act(() => vi.advanceTimersByTime(400));
    expect((screen.getByTestId("name-field") as HTMLInputElement).value).toBe("Beatrice");
    vi.useRealTimers();
  });
});

describe("L17 · Notification Settings", () => {
  it("stops generating entirely once the bell is found", () => {
    vi.useFakeTimers();
    mount(BY_ID.get("L17")!);
    act(() => vi.advanceTimersByTime(5000));
    const before = screen.getByTestId("toasts").children.length;
    expect(before).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("bell"));
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByTestId("toasts").children.length).toBe(before);
    vi.useRealTimers();
  });

  it("spawns more than it clears while unmuted, so whack-a-mole cannot win", () => {
    vi.useFakeTimers();
    mount(BY_ID.get("L17")!);
    act(() => vi.advanceTimersByTime(1500));

    let dismissals = 0;
    for (let i = 0; i < 12; i++) {
      const stack = screen.getByTestId("toasts");
      const close = stack.querySelector("button");
      if (!close) break;
      fireEvent.click(close);
      dismissals++;
    }
    /* Still standing after a dozen dismissals. The button stays covered. */
    expect(dismissals).toBeGreaterThan(0);
    expect(screen.getByTestId("toasts").children.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});

describe("L21 · Rate Your Experience", () => {
  it("registers the lagged value, not the live one", () => {
    vi.useFakeTimers();
    mount(BY_ID.get("L21")!);
    const stars = screen.getByTestId("stars");
    stars.getBoundingClientRect = () => ({ left: 0, width: 250 }) as DOMRect;

    fireEvent.pointerMove(stars, { clientX: 200 }); // four stars, live
    /* Nothing has caught up yet — the readout is still the old value. */
    expect(screen.getByTestId("rating-readout").textContent).toMatch(/No rating yet/);

    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByTestId("rating-readout").textContent).toMatch(/4 of 5/);
    vi.useRealTimers();
  });

  it("solves when the settled value is four", () => {
    vi.useFakeTimers();
    const p = mount(BY_ID.get("L21")!);
    const stars = screen.getByTestId("stars");
    stars.getBoundingClientRect = () => ({ left: 0, width: 250 }) as DOMRect;
    fireEvent.pointerMove(stars, { clientX: 200 });
    act(() => vi.advanceTimersByTime(700));
    fireEvent.click(screen.getByTestId("star-4"));
    expect(p.onSolve).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe("L29 · Adjust Your Volume", () => {
  it("is solvable without hearing anything at all", () => {
    /* The fallback exists so a colour-blind, deaf, muted or WebAudio-less
       player has a real route through — not a lesser one. */
    const mod = BY_ID.get("L29")!;
    expect(mod.Fallback).toBeTruthy();
    const Degraded = mod.Fallback!;

    const p = props();
    render(<Degraded {...p} />);
    const stage = screen.getByTestId("sonar");
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;

    /* The three fields sit where a normal form would put them. */
    for (const [x, y] of [[50, 22], [32, 55], [74, 55]]) {
      fireEvent.pointerDown(stage, { clientX: x, clientY: y });
    }
    fireEvent.click(screen.getByText("Submit Form"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });
});

describe("L30 · Complete Your Profile", () => {
  it("loses your answers when you use Back from the last step", () => {
    const p = mount(BY_ID.get("L30")!);
    fireEvent.click(screen.getByTestId("dot-1"));
    fireEvent.change(screen.getByTestId("field-code"), { target: { value: "WS-1234" } });
    fireEvent.click(screen.getByTestId("dot-3"));
    fireEvent.click(screen.getByTestId("back"));

    expect(screen.getByTestId("step-0")).toBeTruthy();
    fireEvent.click(screen.getByTestId("dot-1"));
    expect((screen.getByTestId("field-code") as HTMLInputElement).value).toBe("");
    expect(p.onFail).toHaveBeenCalled();
  });

  it("keeps everything when you use the dots, which is the honest solve", () => {
    const p = mount(BY_ID.get("L30")!);
    fireEvent.click(screen.getByTestId("dot-2"));
    const code = screen.getByTestId("workspace-code").textContent!;

    fireEvent.click(screen.getByTestId("dot-1"));
    fireEvent.change(screen.getByTestId("field-code"), { target: { value: code } });
    fireEvent.click(screen.getByTestId("dot-3"));
    fireEvent.click(screen.getByText("Finish"));

    expect(p.onSolve).toHaveBeenCalledOnce();
  });
});
