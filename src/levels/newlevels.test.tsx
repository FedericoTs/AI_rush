import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BY_ID } from "./registry";
import { streamFor } from "@/engine/rng";
import { createSilentSfx } from "@/engine/sfx";
import type { LevelModule, LevelProps } from "@/engine/types";

afterEach(cleanup);

function mount(id: string) {
  const mod = BY_ID.get(id) as LevelModule;
  const p: LevelProps = {
    onSolve: vi.fn(),
    onFail: vi.fn(),
    rng: streamFor(4242, id),
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

describe("L04 · How Many?", () => {
  it("solves at exactly three, using the fine controls", () => {
    const p = mount("L04");
    const slider = screen.getByLabelText("Number of licenses");
    fireEvent.change(slider, { target: { value: "5" } });
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByLabelText("One fewer"));
    fireEvent.click(screen.getByText("Continue To Checkout"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("rejects a plausible-looking wrong number and resets", () => {
    const p = mount("L04");
    fireEvent.change(screen.getByLabelText("Number of licenses"), { target: { value: "4" } });
    fireEvent.click(screen.getByText("Continue To Checkout"));
    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getByText(/That's 4 licenses/)).toBeTruthy();
  });
});

describe("L05 · Accept Our Cookies", () => {
  it("cannot be solved by toggling: three of them keep each other alive", () => {
    const p = mount("L05");
    /* Turn everything off the obvious way. The cycle will not allow it. */
    for (const name of ["Analytics", "Personalisation", "Performance"]) {
      fireEvent.click(screen.getByLabelText(name));
    }
    fireEvent.click(screen.getByText("Accept All"));
    expect(p.onSolve).not.toHaveBeenCalled();
  });

  it("Reject All turns everything on, as promised", () => {
    const p = mount("L05");
    fireEvent.click(screen.getByText("Reject All"));
    expect(p.onFail).toHaveBeenCalledOnce();
    expect(screen.getByText(/All partners enabled/)).toBeTruthy();
    expect(screen.getByText(/47 of 47 partners enabled/)).toBeTruthy();
  });

  it("solves through the Legitimate Interest escape", () => {
    const p = mount("L05");
    /* "Legitimate Interest" is both a tab and the 47th vendor in the list,
       which is the joke — so address the tab by role, not by text. */
    fireEvent.click(screen.getByRole("button", { name: "Legitimate Interest" }));
    fireEvent.click(screen.getByText("Object to all"));
    fireEvent.click(screen.getByRole("button", { name: /^Consent/ }));
    expect(screen.getByText(/0 of 47 partners enabled/)).toBeTruthy();
    fireEvent.click(screen.getByText("Accept All"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });
});

describe("L16 · Backspace Unavailable", () => {
  const field = () => screen.getByLabelText("Your full name") as HTMLInputElement;

  it("backspace adds a character instead of removing one", () => {
    mount("L16");
    fireEvent.change(field(), { target: { value: "Ada" } });
    fireEvent.keyDown(field(), { key: "Backspace" });
    expect(field().value).toBe("Adaa");
  });

  it("solves by selecting and typing over the mess", () => {
    const p = mount("L16");
    fireEvent.change(field(), { target: { value: "Adaa" } });
    /* Select-and-replace is exactly what a browser does, and nobody broke it. */
    fireEvent.change(field(), { target: { value: "Ada Lovelace" } });
    fireEvent.click(screen.getByText("Save Profile"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });
});

describe("L22 · Loading Your Dashboard", () => {
  it("solves by ratcheting the tiny real number to a hundred", () => {
    const p = mount("L22");
    const real = screen.getByLabelText("Actual progress");
    expect(real.textContent).toBe("0.00%");
    for (let i = 0; i < 80; i++) fireEvent.keyDown(real, { key: "ArrowUp" });
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("the theatrical bar never reaches a hundred on its own", () => {
    mount("L22");
    expect(screen.getByText(/almost there/)).toBeTruthy();
  });
});

describe("L27 · Confirm Your Address", () => {
  it("puts the right address first when nothing is typed", () => {
    const p = mount("L27");
    fireEvent.focus(screen.getByLabelText("Address"));
    const options = screen.getAllByRole("option");
    expect(options[0]!.textContent).toBe("221B Baker Street, London");
    fireEvent.click(options[0]!);
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("buries the right address the moment you start typing", () => {
    mount("L27");
    const input = screen.getByLabelText("Address");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "221B Baker" } });
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options[0]).not.toBe("221B Baker Street, London");
  });
});

describe("L28 · Are You Still There?", () => {
  it("solves on the fleeing button", () => {
    const p = mount("L28");
    fireEvent.click(screen.getByText(/Yes, I/));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("logging out is honest, and no help at all", () => {
    const p = mount("L28");
    fireEvent.click(screen.getByText("Log me out"));
    expect(p.onSolve).not.toHaveBeenCalled();
    expect(p.onFail).toHaveBeenCalledOnce();
  });
});

describe("L42 · Confirm Your Password", () => {
  const pw = () => screen.getByLabelText("Password") as HTMLInputElement;
  const confirm = () => screen.getByLabelText("Confirm Password") as HTMLInputElement;

  it("mirrors one character behind, so they never match on their own", () => {
    mount("L42");
    fireEvent.change(pw(), { target: { value: "hunter22" } });
    expect(confirm().value).toBe("hunter2");
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
  });

  it("solves by adding the missing character by hand", () => {
    const p = mount("L42");
    fireEvent.change(pw(), { target: { value: "hunter22" } });
    fireEvent.change(confirm(), { target: { value: "hunter22" } });
    fireEvent.click(screen.getByText("Create Account"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });

  it("solves by filling Confirm first, which stops the mirroring", () => {
    const p = mount("L42");
    fireEvent.change(confirm(), { target: { value: "hunter22" } });
    fireEvent.change(pw(), { target: { value: "hunter22" } });
    expect(confirm().value).toBe("hunter22");
    fireEvent.click(screen.getByText("Create Account"));
    expect(p.onSolve).toHaveBeenCalledOnce();
  });
});
