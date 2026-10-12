import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

/** Minimal readiness endpoint for Docker and uptime checks; it exposes no configuration. */
export async function GET() {
  try {
    await db.queryOne<{ ready: number }>("SELECT 1 AS ready");
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
