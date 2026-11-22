import { NextResponse } from "next/server";
import { saveWatchGraphSchema } from "@/lib/validation/watch-graph";
import { parseJson } from "@/lib/validation/api";
import { withSession } from "@/server/session/request";

export async function GET(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  return withSession(request, async ({ services, userId }) => {
    const { logicalIntentId } = await context.params;
    return NextResponse.json(await services.watchGraphs.get(userId, logicalIntentId));
  });
}

export async function POST(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  return withSession(request, async ({ services, userId }) => {
    const { logicalIntentId } = await context.params;
    const input = await parseJson(request, saveWatchGraphSchema);
    return NextResponse.json({ graph: await services.watchGraphs.create(userId, logicalIntentId, input) }, { status: 201 });
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ logicalIntentId: string }> }) {
  return withSession(request, async ({ services, userId }) => {
    const { logicalIntentId } = await context.params;
    const input = await parseJson(request, saveWatchGraphSchema);
    return NextResponse.json({ graph: await services.watchGraphs.edit(userId, logicalIntentId, input) });
  });
}
