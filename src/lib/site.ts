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
