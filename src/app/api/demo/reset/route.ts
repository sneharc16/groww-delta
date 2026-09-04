import { NextResponse } from "next/server";
import { apiError } from "@/lib/validation/api";
import { services } from "@/server/container";

export async function POST() {
  try {
    return NextResponse.json(await services.demo.reset());
  } catch (error: unknown) {
    return apiError(error);
  }
}
