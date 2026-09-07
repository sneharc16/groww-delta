import { NextResponse } from "next/server";
import { services } from "@/server/container";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ scenarios: services.demo.listScenarios() }); }
