import { NextResponse } from "next/server";
import { withSession } from "@/server/session/request";

export async function POST(request: Request) {
  return withSession(request, async ({ services, userId }) => {
    return NextResponse.json(await services.demo.reset(userId));
  });
}
