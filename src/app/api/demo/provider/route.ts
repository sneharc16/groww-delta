import { NextResponse } from "next/server";
import { z } from "zod";
import { services } from "@/server/container";
import { apiError, parseJson } from "@/lib/validation/api";
export async function POST(request: Request) {
  try { const { status } = await parseJson(request, z.object({ status: z.enum(["HEALTHY", "DEGRADED", "UNAVAILABLE"]) }).strict());
    return NextResponse.json(await services.demo.setProviderStatus(status));
  } catch (error: unknown) { return apiError(error); }
}
