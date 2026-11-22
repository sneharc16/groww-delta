import { NextResponse } from "next/server";
import { z } from "zod";
import { withSession } from "@/server/session/request";
import { parseJson } from "@/lib/validation/api";
export async function POST(request: Request) {
  return withSession(request, async ({ services, userId }) => { const { scenarioId } = await parseJson(request, z.object({ scenarioId: z.string().min(1).max(100) }).strict());
    return NextResponse.json(await services.demo.switchScenario(scenarioId, userId));
  });
}
