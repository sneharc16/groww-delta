import { NextResponse } from "next/server";
import { withSession } from "@/server/session/request";

export async function POST(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  return withSession(request, async ({ services, userId }) => {
    const { logicalIntentId } = await context.params;
    return NextResponse.json({ intent: await services.intentLifecycle.resolve(userId, logicalIntentId) });
  });
}
