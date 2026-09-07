import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/constants";
import { services } from "@/server/container";
import { corporateDecisionSchema } from "@/server/services/corporate-action-service";
import { apiError, parseJson } from "@/lib/validation/api";
export async function POST(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  try {
    const { logicalIntentId } = await context.params;
    return NextResponse.json(await services.corporateActions.decide(DEMO_USER_ID, logicalIntentId, await parseJson(request, corporateDecisionSchema)));
  } catch (error: unknown) { return apiError(error); }
}
