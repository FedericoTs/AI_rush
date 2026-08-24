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
