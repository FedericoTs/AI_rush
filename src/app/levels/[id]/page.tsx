import { notFound } from "next/navigation";
import { decodeSeed } from "@/engine/rng";
import { CATALOG, META_BY_ID, parseLevelSelection } from "@/levels/catalog";
import { RunClient } from "@/app/play/RunClient";

/**
 * One level, on its own.
 *
 * `/levels/L37` is a single level, `/levels/all` is the whole catalogue in
 * order, and `/levels/L01,L11` is a hand-written pair — the same parser the
 * play route uses for `?level=`, so anything that works in one works in both.
 *
 * The seed still arrives in the URL from the proxy: levels seed their own
 * randomness from it, and without one every attempt at L37 would deal the same
 * four dials forever.
 */
export default async function LevelPractice({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ seed?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const selection = parseLevelSelection(decodeURIComponent(id));
  if (!selection) notFound();

  const decoded = query.seed ? decodeSeed(query.seed) : null;

  return <RunClient seed={decoded?.seed ?? 0} mercy={false} practice={selection} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meta = META_BY_ID.get(decodeURIComponent(id).toUpperCase());

  if (!meta) return { title: `Practice · ${CATALOG.length} levels` };
  return { title: `${meta.title} · practice`, description: meta.parodies };
}
