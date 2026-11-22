import { NextResponse } from "next/server";
import { withSession } from "@/server/session/request";
import { corporateDecisionSchema } from "@/server/services/corporate-action-service";
import { parseJson } from "@/lib/validation/api";
export async function POST(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  return withSession(request, async ({ services, userId }) => {
    const { logicalIntentId } = await context.params;
    return NextResponse.json(await services.corporateActions.decide(userId, logicalIntentId, await parseJson(request, corporateDecisionSchema)));
  });
}
