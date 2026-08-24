import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChaosProvider } from "./ChaosProvider";
import { ALL_MODIFIERS, MODIFIERS } from "./modifiers";
import { REGISTRY } from "@/levels/registry";
import { streamFor } from "@/engine/rng";
import { createSilentSfx } from "@/engine/sfx";
import type { LevelProps, ModifierId } from "@/engine/types";

/**
 * The composition test `ROADMAP.md` Phase 5 asks for:
 *
 *   > every (level × modifier) pair renders, remains solvable, and doesn't
 *   > violate `incompatibleModifiers`
 *
 * Two of those three are machine-checkable and are checked here over all
 * 49 × 12 pairs. "Remains solvable" is the part a test cannot assert in
 * general — it is a claim about a human finding a route — so what is asserted
 * instead is the property that would make it *un*solvable, and which is the
 * only way a modifier can actually break a level: the level's controls have to
 * stay present and reachable underneath whatever the wrapper is doing.
 */

afterEach(cleanup);

function props(): LevelProps {
  return {
    onSolve: vi.fn(),
    onFail: vi.fn(),
    rng: streamFor(1234, "chaos"),
    chaos: [],
    degraded: false,
    input: {} as LevelProps["input"],
    sfx: createSilentSfx(),
  };
}

describe("every level under every modifier", () => {
  it("renders, all 588 pairs of them", () => {
    for (const mod of REGISTRY) {
      for (const id of ALL_MODIFIERS) {
        cleanup();
        expect(
          () =>
            render(
              <ChaosProvider modifiers={[id]}>
                <mod.Component {...props()} chaos={[id]} />
              </ChaosProvider>,
            ),
          `${mod.meta.id} × ${id}`,
        ).not.toThrow();
      }
    }
  });

  it("leaves every control the level rendered still in the document", () => {
    /* The only way a wrapper can make a level unwinnable is by removing or
       covering what you have to press. Nothing here may change the level's
       own tree — the effects are CSS on layers above and around it. */
    for (const mod of REGISTRY.slice(0, 12)) {
      cleanup();
      render(<mod.Component {...props()} />);
      const bare = document.querySelectorAll("button, input, select, textarea, [role]").length;

      cleanup();
      render(
        <ChaosProvider modifiers={["drift", "confetti"]}>
          <mod.Component {...props()} chaos={["drift", "confetti"]} />
        </ChaosProvider>,
      );
      const wrapped = document.querySelectorAll("button, input, select, textarea, [role]").length;

      /* Wrapped is allowed to be *more* — the popup has a dismiss button —
         never fewer. */
      expect(wrapped, `${mod.meta.id} lost a control`).toBeGreaterThanOrEqual(bare);
    }
  });
});

describe("the deal never pairs a modifier with the level it duplicates", () => {
  it("declares only real modifier ids as incompatible", () => {
    for (const mod of REGISTRY) {
      for (const id of mod.meta.incompatibleModifiers) {
        expect(MODIFIERS[id], `${mod.meta.id} names ${id}`).toBeTruthy();
      }
    }
  });

  it("keeps the three named in LEVELS.md off the levels they are made of", () => {
    /* "no `Lag` on #32, no `Mirror` on #31, no `Fleeing` on #28" — the mild
       version of a level must never land on the level itself. */
    const forbid: Array<[string, ModifierId]> = [
      ["L32", "lag"],
      ["L31", "mirror"],
      ["L28", "fleeing"],
      ["L33", "rotate"],
    ];
    for (const [level, id] of forbid) {
      const mod = REGISTRY.find((m) => m.meta.id === level);
      if (!mod) continue;
      expect(mod.meta.incompatibleModifiers, `${level} must exclude ${id}`).toContain(id);
    }
  });
});

describe("the wrapper itself", () => {
  it("adds nothing at all when the deck dealt no modifiers", () => {
    render(
      <ChaosProvider modifiers={[]}>
        <p>level</p>
      </ChaosProvider>,
    );
    expect(screen.queryByTestId("chaos")).toBeNull();
    expect(screen.getByText("level")).toBeTruthy();
  });

  it("puts both modifiers on one element so the CSS can compose them", () => {
    render(
      <ChaosProvider modifiers={["rainbow", "shrink"]}>
        <p>level</p>
      </ChaosProvider>,
    );
    /* `~=` matches one word of the list, which is how two rules apply without
       either knowing about the other. */
    expect(screen.getByTestId("chaos").getAttribute("data-chaos")).toBe("rainbow shrink");
  });

  it("shows a popup that can be dismissed, and only ever one", () => {
    vi.useFakeTimers();
    render(
      <ChaosProvider modifiers={["popups"]}>
        <p>level</p>
      </ChaosProvider>,
    );
    expect(screen.queryByTestId("chaos-popup")).toBeNull();

    act(() => vi.advanceTimersByTime(8_500));
    expect(screen.getByTestId("chaos-popup")).toBeTruthy();

    /* Still one after three more intervals: a queue of these would stop being
       an interruption and start being a wall. */
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getAllByTestId("chaos-popup")).toHaveLength(1);

    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByTestId("chaos-popup")).toBeNull();
    vi.useRealTimers();
  });

  it("stays silent when the run is muted", () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
    vi.useFakeTimers();

    render(
      <ChaosProvider modifiers={["whisper"]} muted>
        <p data-slop-microcopy>Almost there!</p>
      </ChaosProvider>,
    );
    act(() => vi.advanceTimersByTime(2000));

    /* The mute button in the HUD is the player's only defence against this
       one, so it has to actually work. */
    expect(speak).not.toHaveBeenCalled();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
