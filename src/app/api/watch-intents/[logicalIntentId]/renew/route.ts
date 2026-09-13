import { NextResponse } from "next/server";
import { renewIntentSchema } from "@/lib/validation/intent-lifecycle";
import { parseJson } from "@/lib/validation/api";
import { withSession } from "@/server/session/request";

export async function POST(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  return withSession(request, async ({ services, userId }) => {
    const { logicalIntentId } = await context.params;
    const input = await parseJson(request, renewIntentSchema);
    return NextResponse.json(await services.intentLifecycle.renew(userId, logicalIntentId, input), { status: 201 });
  });
}
