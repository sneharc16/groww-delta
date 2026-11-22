import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson } from "@/lib/validation/api";
import { withSession } from "@/server/session/request";

const schema = z.object({ instrumentId: z.string().trim().min(1) }).strict();

export async function POST(request: Request) {
  return withSession(request, async ({ services, userId }) => {
    const { instrumentId } = await parseJson(request, schema);
    return NextResponse.json({ item: await services.watchlist.add(userId, instrumentId) }, { status: 201 });
  });
}
