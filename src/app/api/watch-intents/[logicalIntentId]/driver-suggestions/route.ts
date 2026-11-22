import { NextResponse } from "next/server";
import { withSession } from "@/server/session/request";

export async function GET(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  return withSession(request, async ({ services, userId }) => {
    const { logicalIntentId } = await context.params;
    return NextResponse.json({ suggestions: await services.watchGraphs.suggestions(userId, logicalIntentId) });
  });
}
