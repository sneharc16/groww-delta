import { NextResponse } from "next/server";
import { z } from "zod";
import { withSession } from "@/server/session/request";
import { parseJson } from "@/lib/validation/api";
export async function POST(request: Request) {
  return withSession(request, async ({ services }) => { const { status } = await parseJson(request, z.object({ status: z.enum(["HEALTHY", "DEGRADED", "UNAVAILABLE"]) }).strict());
    return NextResponse.json(await services.demo.setProviderStatus(status));
  });
}
