import { NextResponse } from "next/server";
import { withSession } from "@/server/session/request";

export async function POST(request: Request) {
  return withSession(request, async ({ services }) => {
    return NextResponse.json(await services.demo.advance());
  });
}
