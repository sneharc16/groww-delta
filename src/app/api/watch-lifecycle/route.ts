import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { withSession } from "@/server/session/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withSession(request, async ({ services, userId }) => {
    const instrumentId = new URL(request.url).searchParams.get("instrumentId");
    if (!instrumentId) throw new AppError("INSTRUMENT_ID_REQUIRED", "instrumentId is required.", 400);
    return NextResponse.json(await services.intentLifecycle.getInstrument(userId, instrumentId));
  });
}
