import { NextResponse } from "next/server";
import { z } from "zod";
import { withSession } from "@/server/session/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withSession(request, async ({ services }) => {
    const raw = new URL(request.url).searchParams.get("sinceSequence") ?? "-1";
    const sinceSequence = z.coerce.number().int().min(-1).parse(raw);
    return NextResponse.json({ events: await services.market.eventsSince(sinceSequence) });
  });
}
