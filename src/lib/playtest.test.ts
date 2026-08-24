import { describe, expect, it } from "vitest";
import { MARKS, MARK_KINDS, sessionFilename } from "./playtest";

describe("playtest marks", () => {
  /*
   * The one property that actually matters about the shortcuts.
   *
   * Half the catalogue is text fields — L02 takes six digits, L12 takes a
   * phone number, L06 takes a password — so a bare-digit shortcut would be
   * typed into the level instead of tagging the moment. The binding is
   * Alt+digit for that reason, and this asserts nobody quietly "simplifies" it
   * back into a plain key.
   */
  it("binds only single characters, never a bare key the levels would eat", () => {
    for (const kind of MARK_KINDS) {
      expect(MARKS[kind].key).toHaveLength(1);
    }
  });

  it("gives every kind a distinct key", () => {
    const keys = MARK_KINDS.map((k) => MARKS[k].key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("names what the facilitator is looking for, not just the label", () => {
    for (const kind of MARK_KINDS) {
      expect(MARKS[kind].hint.length).toBeGreaterThan(8);
    }
  });
});

describe("sessionFilename", () => {
  const now = new Date("2026-03-14T15:09:26.535Z");

  it("sorts by time and says who it was", () => {
    expect(sessionFilename({ subject: "P3 · iPhone 13 · cold", seed: "ABC123" }, now)).toBe(
      "playtest-2026-03-14T15-09-26-p3-iphone-13-cold.json",
    );
  });

  it("falls back to the seed when nobody typed a name", () => {
    expect(sessionFilename({ subject: "   ", seed: "ABC123" }, now)).toBe(
      "playtest-2026-03-14T15-09-26-ABC123.json",
    );
  });

  /* A subject is free text typed under time pressure by someone who has just
     watched a stranger struggle. It reaches a filesystem, so it does not get
     to contain a path separator. */
  it("cannot produce a path", () => {
    const name = sessionFilename({ subject: "../../etc/passwd", seed: "S" }, now);
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
  });
});
