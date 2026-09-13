import { NextResponse } from "next/server";
import { withSession } from "@/server/session/request";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return withSession(request, async ({ services, userId }) => {
    const { id } = await context.params;
    return NextResponse.json(await services.watchlist.remove(userId, id));
  });
}
