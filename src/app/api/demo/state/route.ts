import { NextResponse } from "next/server";
import { withSession } from "@/server/session/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withSession(request, async ({ services }) => {
    return NextResponse.json(await services.demo.getState());
  });
}
