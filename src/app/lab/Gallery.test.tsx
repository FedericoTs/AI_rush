import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Gallery } from "./Gallery";
import type { LabCard } from "@/lib/db";

/**
 * The gallery renders other people's words.
 *
 * Which makes one of these tests load-bearing rather than incidental: every
 * string on a card was typed by a stranger, and `COMMUNITY_LEVELS.md` §5 says
 * it is "stored as text and rendered as text. Never interpreted as HTML."
 * React escapes by default, so the failure mode is somebody later reaching for
 * `dangerouslySetInnerHTML` to make a link work. This asserts the boundary
 * directly so that change breaks a test rather than shipping.
 */

const card = (over: Partial<LabCard> = {}): LabCard => ({
  id: "11111111-2222-3333-4444-555555555555",
  x_handle: "@someone",
  title: "Infinite Zoom Consent",
  parodies: "a cookie banner",
  mechanic: "The accept button gets smaller every time you move toward it.",
  inputs: ["mouse"],
  status: "approved",
  rejection_note: null,
  shipped_level_id: null,
  votes: 7,
  created_at: "2026-03-01T00:00:00Z",
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: true, votes: 8 }))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the gallery", () => {
  it("renders submitted text as text, never as markup", () => {
    render(
      <Gallery
        sort="top"
        cards={[
          card({
            title: "<img src=x onerror=alert(1)>",
            mechanic: "<script>alert('mechanic')</script> and then it does a thing",
          }),
        ]}
      />,
    );

    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("shows a rejection with its reason, rather than hiding it", () => {
    render(
      <Gallery
        sort="top"
        cards={[card({ status: "rejected", rejection_note: "too close to L12" })]}
      />,
    );

    expect(screen.getByText("NOT SHIPPING")).toBeTruthy();
    expect(screen.getByText(/too close to L12/)).toBeTruthy();
    /* Nothing to vote for once the answer is no — but the count it got stays
       visible, because "we said no to a popular idea" is the honest record. */
    expect(screen.queryByRole("button", { name: /build this/ })).toBeNull();
    expect(screen.getByText(/7 votes before we said no/)).toBeTruthy();
  });

  it("stamps a shipped submission and links to the level", () => {
    render(<Gallery sort="shipped" cards={[card({ status: "shipped", shipped_level_id: "L52" })]} />);
    const link = screen.getByRole("link", { name: /SHIPPED · L52/ });
    expect(link.getAttribute("href")).toBe("/levels/L52");
  });

  it("takes the vote count from the server's recount, not from a local increment", async () => {
    render(<Gallery sort="top" cards={[card({ votes: 7 })]} />);
    const button = screen.getByRole("button", { name: /build this/ });

    fireEvent.click(button);

    /* The server said 8. Had this incremented locally it would also say 8 and
       the test would pass by accident — so the stub deliberately returns a
       number two ahead of what a local increment would produce. */
    await waitFor(() => expect(screen.getByText("8")).toBeTruthy());
    expect(screen.getByRole("button", { name: /voted/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("refuses to vote when no ballot could be minted", () => {
    /* Storage blocked: the button does nothing rather than pretending. */
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    render(<Gallery sort="top" cards={[card()]} />);
    fireEvent.click(screen.getByRole("button", { name: /build this/ }));

    expect(fetch).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("says what is missing when there is nothing to show", () => {
    render(<Gallery sort="shipped" cards={[]} />);
    expect(screen.getByText(/Nothing from the Lab has shipped yet/)).toBeTruthy();
  });
});
