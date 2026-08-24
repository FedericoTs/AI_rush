import { decodeSeed } from "@/engine/rng";
import { RunClient } from "./RunClient";

/**
 * The seed always arrives in the URL — middleware puts it there. Phase 3
 * swaps this for a server-issued run token and the /r/[seed] challenge route.
 */
export default async function Play({
  searchParams,
}: {
  searchParams: Promise<{ seed?: string; mercy?: string }>;
}) {
  const params = await searchParams;
  const decoded = params.seed ? decodeSeed(params.seed) : null;
  return <RunClient seed={decoded?.seed ?? 0} mercy={params.mercy === "1"} />;
}
