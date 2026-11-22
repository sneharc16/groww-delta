import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { createWatchIntentSchema } from "@/domain/intent/schemas";
import { parseJson } from "@/lib/validation/api";
import { withSession } from "@/server/session/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withSession(request, async ({ services, userId }) => {
    const instrumentId = new URL(request.url).searchParams.get("instrumentId");
    if (!instrumentId) throw new AppError("INSTRUMENT_ID_REQUIRED", "instrumentId is required.", 400);
    return NextResponse.json({ intents: await services.watchIntents.list(userId, instrumentId) });
  });
}

export async function POST(request: Request) {
  return withSession(request, async ({ services, userId }) => {
    const { instrumentId, intent } = await parseJson(request, createWatchIntentSchema);
    return NextResponse.json({ intent: await services.watchIntents.create(userId, instrumentId, intent) }, { status: 201 });
  });
}
