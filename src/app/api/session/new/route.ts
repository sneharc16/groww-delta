import { NextResponse } from "next/server";
import { withSession } from "@/server/session/request";
/** Explicit recovery only: leaves old anonymous history intact until retention cleanup. */
export async function POST(request: Request) {
  return withSession(request, async () => NextResponse.json({ ready: true }), { startNew: true });
}
