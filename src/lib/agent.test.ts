import { afterEach, describe, expect, it } from "vitest";
import { agentIdentity, ARENA_KEY } from "./agent";

/**
 * The marker decides which of two tables a run is filed in, and one of those
 * tables is the human column of the asymmetry table. Getting it wrong in the
 * permissive direction is the expensive failure: a machine's run counted as a
 * person's is not a missing row, it is a wrong one, and nothing downstream can
 * tell afterwards.
 */

function url(search: string) {
  window.history.replaceState({}, "", `/play${search}`);
}

afterEach(() => {
  window.localStorage.removeItem(ARENA_KEY);
  url("");
});

describe("a person", () => {
  it("is not an agent", () => {
    expect(agentIdentity()).toBeNull();
  });

  it("is still not an agent when storage holds nonsense", () => {
    window.localStorage.setItem(ARENA_KEY, "not json at all");
    expect(agentIdentity()).toBeNull();
  });

  it("is still not an agent when the name would not survive the database", () => {
    /* Coercing it into something valid would file a run under a name nobody
       chose, which then sits in the aggregate looking like data. */
    window.localStorage.setItem(ARENA_KEY, JSON.stringify({ agent: "  " }));
    expect(agentIdentity()).toBeNull();
    window.localStorage.setItem(ARENA_KEY, JSON.stringify({ agent: "<script>" }));
    expect(agentIdentity()).toBeNull();
  });
});

describe("a harness", () => {
  it("is recognised from storage", () => {
    window.localStorage.setItem(
      ARENA_KEY,
      JSON.stringify({ agent: "claude-opus-5", operator: "@federicots", harness: "mcp/0.1" }),
    );
    expect(agentIdentity()).toEqual({
      agent: "claude-opus-5",
      operator: "@federicots",
      harness: "mcp/0.1",
    });
  });

  it("is recognised from the URL when storage is empty", () => {
    /* The channel that survives blocked storage. Losing the marker silently
       is the one failure that corrupts the dataset rather than shrinking it. */
    url("?arena=some-harness");
    expect(agentIdentity()?.agent).toBe("some-harness");
  });

  it("lets the URL win, and still takes the operator from storage", () => {
    window.localStorage.setItem(
      ARENA_KEY,
      JSON.stringify({ agent: "stale", operator: "@federicots" }),
    );
    url("?arena=fresh");
    expect(agentIdentity()).toEqual({ agent: "fresh", operator: "@federicots" });
  });

  it("drops an operator that is not a plausible handle", () => {
    window.localStorage.setItem(
      ARENA_KEY,
      JSON.stringify({ agent: "a-harness", operator: "not a handle at all" }),
    );
    expect(agentIdentity()).toEqual({ agent: "a-harness" });
  });
});
