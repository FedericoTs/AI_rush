import { NextResponse, type NextRequest } from "next/server";

/**
 * Every run gets a seed, and the seed lives in the URL.
 *
 * Generated here rather than in the page because a React render must be pure —
 * and because putting it in the URL is the behaviour we want anyway: a run
 * becomes shareable the moment it starts. Phase 3 replaces this with a
 * server-issued run token and the /r/[seed] challenge route.
 */
export function proxy(req: NextRequest) {
  if (req.nextUrl.searchParams.has("seed")) return NextResponse.next();

  const [value] = crypto.getRandomValues(new Uint32Array(1));
  const url = req.nextUrl.clone();
  url.searchParams.set("seed", (value! >>> 0).toString(16).toUpperCase().padStart(6, "0"));
  return NextResponse.redirect(url);
}

export const config = { matcher: "/play" };
