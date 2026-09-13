import { NextResponse } from "next/server";
import { updateWatchIntentSchema } from "@/domain/intent/schemas";
import { parseJson } from "@/lib/validation/api";
import { withSession } from "@/server/session/request";

export async function PATCH(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  return withSession(request, async ({ services, userId }) => {
    const { logicalIntentId } = await context.params;
    const input = await parseJson(request, updateWatchIntentSchema);
    return NextResponse.json({ intent: await services.watchIntents.edit(userId, logicalIntentId, input) });
  });
}
