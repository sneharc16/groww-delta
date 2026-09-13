import { NextResponse } from "next/server";
import { acknowledgeSchema } from "@/lib/validation/catch-up";
import { parseJson } from "@/lib/validation/api";
import { withSession } from "@/server/session/request";

export async function POST(request: Request) {
  return withSession(request, async ({ services, userId }) => {
    const input = await parseJson(request, acknowledgeSchema);
    return NextResponse.json(await services.catchUp.acknowledge(userId, input));
  });
}
