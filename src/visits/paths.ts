/**
 * What a visit is allowed to say about itself.
 *
 * The path and the referrer arrive from a browser, which means they arrive
 * from anybody. Storing them raw gives an open text column in a public table
 * and a cardinality that grows with whatever somebody feels like posting, so
 * both are folded onto a fixed set of known values here and anything
 * unrecognised becomes a single bucket.
 *
 * That also keeps the numbers readable: forty rows of `/levels/L37`,
 * `/levels/L11` and so on answer no question anybody is asking, and
 * `/levels/[id]` answers the one they are.
 */

/** Every route this app serves. Anything else is somebody probing. */
const EXACT = new Set([
  "/", "/play", "/levels", "/board", "/lab", "/arena", "/slop", "/offline",
]);

export const OTHER = "/other";

export function normalisePath(raw: string): string {
  let path = String(raw || "").trim();
  if (!path.startsWith("/")) return OTHER;

  /* Query and hash carry seeds, handles and challenge parameters. None of it
     is needed to count a visit and some of it names a person. */
  path = path.split(/[?#]/)[0]!;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "") path = "/";

  if (EXACT.has(path)) return path;
  /* One row per level id would be forty-nine rows answering nothing. */
  if (/^\/levels\/[^/]+$/.test(path)) return "/levels/[id]";
  return OTHER;
}

/**
 * Did this view start somewhere other than our own site?
 *
 * "First view in this document" is not the same as "an arrival", and the
 * difference is a redirect. `/play` 307s to add a seed to the URL, so pressing
 * START is a full document load: the page's own "have I arrived" flag resets
 * and the visit reports itself as new. The referrer is then our own host, so
 * it is dropped as internal and the phantom lands in `(direct)`.
 *
 * Left alone that inflates arrivals by roughly everyone who starts a run, and
 * splits real traffic between its true source and `(direct)` — corrupting the
 * one number the table exists to produce.
 *
 * Both conditions are needed. The in-document flag catches client-side
 * navigation, where the referrer never changes and would keep crediting
 * whoever linked to the first page; the referrer catches full-load navigation
 * between our own pages, where the flag has been reset.
 *
 * Deliberately no `sessionStorage`. It would also work, and this schema
 * promises no cookie and no browser storage — a promise worth more than the
 * three lines it saves.
 */
export function isArrival(firstInDocument: boolean, referrer: string | null | undefined, self: string): boolean {
  if (!firstInDocument) return false;
  return !isInternal(referrer, self);
}

/** Our own site, whatever subdomain or preview host it is wearing. */
export function isInternal(referrer: string | null | undefined, self: string): boolean {
  if (!referrer) return false; // no referrer is a direct visit, not an internal one
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  const own = self.toLowerCase().replace(/^www\./, "");
  return host === own || host === "localhost" || host.endsWith(".vercel.app");
}

/**
 * Where somebody came from, as a bare hostname.
 *
 * Never the full URL: a referrer carries the path and query of the page that
 * linked here, which on a social site is somebody's post and on a search
 * engine is what they typed. The hostname is the entire question — did the
 * thread work — and it is all that is kept.
 *
 * Returns null for a direct visit, an unparseable referrer, or our own site,
 * so an internal navigation can never be counted as an arrival.
 */
export function refHost(referrer: string | null | undefined, self: string): string | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host) return null;
  host = host.replace(/^www\./, "");
  const own = self.toLowerCase().replace(/^www\./, "");
  if (host === own || host === "localhost" || host.endsWith(".vercel.app")) return null;
  return host.slice(0, 80);
}
