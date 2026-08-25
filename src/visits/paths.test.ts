import { describe, expect, it } from "vitest";
import { normalisePath, OTHER, refHost } from "./paths";

describe("the path a visit reports", () => {
  it("keeps the routes that exist", () => {
    for (const p of ["/", "/play", "/levels", "/board", "/lab", "/arena", "/slop"]) {
      expect(normalisePath(p)).toBe(p);
    }
  });

  it("folds every level into one row", () => {
    /* Forty-nine rows of /levels/L37 answer no question anybody is asking. */
    expect(normalisePath("/levels/L37")).toBe("/levels/[id]");
    expect(normalisePath("/levels/L01,L11")).toBe("/levels/[id]");
  });

  it("drops the query and the hash", () => {
    /* Seeds, handles and challenge parameters live in there, and one of them
       names a person. None of it is needed to count a visit. */
    expect(normalisePath("/play?seed=F4DA728E&vs=@em&target=7360")).toBe("/play");
    expect(normalisePath("/slop?r=7#top")).toBe("/slop");
  });

  it("buckets anything it does not recognise", () => {
    /* The path arrives from a browser, which means from anybody. */
    expect(normalisePath("/wp-admin.php")).toBe(OTHER);
    expect(normalisePath("/../../etc/passwd")).toBe(OTHER);
    expect(normalisePath("not-a-path")).toBe(OTHER);
    expect(normalisePath("")).toBe(OTHER);
    expect(normalisePath("/" + "x".repeat(5000))).toBe(OTHER);
  });

  it("treats a trailing slash as the same page", () => {
    expect(normalisePath("/levels/")).toBe("/levels");
    expect(normalisePath("/")).toBe("/");
  });
});

describe("where they came from", () => {
  it("keeps the hostname and nothing else", () => {
    /* A referrer carries the linking page's path and query — on a social site
       that is somebody's post, on a search engine it is what they typed. */
    expect(refHost("https://x.com/someone/status/1234567890", "ai-rush.lol")).toBe("x.com");
    expect(refHost("https://www.reddit.com/r/webdev/comments/abc/", "ai-rush.lol")).toBe("reddit.com");
    expect(refHost("https://news.ycombinator.com/item?id=1", "ai-rush.lol")).toBe("news.ycombinator.com");
  });

  it("reports a direct visit as no referrer at all", () => {
    expect(refHost("", "ai-rush.lol")).toBeNull();
    expect(refHost(null, "ai-rush.lol")).toBeNull();
    expect(refHost(undefined, "ai-rush.lol")).toBeNull();
  });

  it("never counts our own pages as an arrival", () => {
    /* Otherwise every internal click reads as traffic from somewhere. */
    expect(refHost("https://ai-rush.lol/levels", "ai-rush.lol")).toBeNull();
    expect(refHost("https://www.ai-rush.lol/", "ai-rush.lol")).toBeNull();
    expect(refHost("http://localhost:3000/play", "ai-rush.lol")).toBeNull();
    expect(refHost("https://ai-rush-git-main.vercel.app/", "ai-rush.lol")).toBeNull();
  });

  it("survives a referrer that is not a URL", () => {
    expect(refHost("garbage", "ai-rush.lol")).toBeNull();
    expect(refHost("javascript:alert(1)", "ai-rush.lol")).toBeNull();
  });
});
