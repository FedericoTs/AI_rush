import { NextResponse } from "next/server";
import { dbConfigured, rpc, selectBoard, type BoardRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!dbConfigured) return NextResponse.json({ rows: [], offline: true });

  const url = new URL(req.url);
  const mercy = url.searchParams.get("mercy") === "1";
  const around = url.searchParams.get("around");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));

  try {
    if (around !== null) {
      const rows = await rpc<Array<{
        rank: number; handle: string; score: number;
        levels_solved: number; killed_by: string | null;
      }>>("board_around", {
        p_score: Math.max(0, Number(around) || 0),
        p_mercy: mercy,
        p_window: 3,
      });
      return NextResponse.json({ rows });
    }
    const rows: BoardRow[] = await selectBoard(mercy, limit);
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [], offline: true });
  }
}
