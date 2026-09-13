import { NextResponse } from "next/server";
import { healthStatus } from "@/server/services/health-service";
export const dynamic = "force-dynamic";
export async function GET() {
  const health=await healthStatus();
  return NextResponse.json(health,{status:health.status==="OK"?200:503,headers:{"Cache-Control":"no-store"}});
}
