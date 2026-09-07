import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_USER_ID } from "@/lib/constants";
import { services } from "@/server/container";
import { apiError, parseJson } from "@/lib/validation/api";
export async function POST(request: Request) {
  try { const { scenarioId } = await parseJson(request, z.object({ scenarioId: z.string().min(1).max(100) }).strict());
    return NextResponse.json(await services.demo.switchScenario(scenarioId, DEMO_USER_ID));
  } catch (error: unknown) { return apiError(error); }
}
