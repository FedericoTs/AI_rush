/**
 * Where this deployment actually lives.
 *
 * `metadataBase` is what absolute-ises og:image, and getting it wrong is
 * invisible locally and fatal in production — X fetches the URL from the page,
 * so a localhost base means every shared card silently fails to render.
 * `VERCEL_PROJECT_PRODUCTION_URL` is set automatically on every deployment, so
 * this needs no configuration; the explicit override is there for a custom
 * domain, which is the case that put this in its own module — the share card
 * prints the address in its footer, and a card that names a host nobody uses
 * is worse than a card with no address on it at all.
 */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

/** Just the host, for the places that show it to a human rather than follow it. */
export function siteHost(): string {
  return siteUrl().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * The share card's cache buster. **Bump this whenever the card's art changes.**
 *
 * X, Slack, iMessage and every other unfurler caches an OG image against its
 * URL, hard and for a long time, and none of them offer a reliable way to ask
 * for a refresh. So a redesigned card at the same URL is a redesigned card
 * nobody sees — the old one keeps circulating on every new post, which is
 * exactly what happened to the first version of this one.
 *
 * Changing the URL is the only thing that actually works. Links already posted
 * keep their old image, which is correct: they were shared with it.
 */
export const OG_VERSION = 2;

/** The absolute URL of the share card, versioned. */
export function ogImage(): string {
  return `/api/og?v=${OG_VERSION}`;
}
