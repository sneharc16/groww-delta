import { measureDatabase } from "@/server/observability/database-metrics";
import { safeLog } from "@/server/observability/log";
import { NextResponse } from "next/server";
import { withSession } from "@/server/session/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withSession(request, async ({ services, userId, requestId }) => {
    const measured = await measureDatabase(() => services.catchUp.getCatchUp(userId));
    const items = [...measured.value.relevant, ...measured.value.significant, ...measured.value.quiet];
    console.info(safeLog({requestId, operation:"attention.evaluate", latencyMs:measured.metrics.latencyMs, result:"OK", researchSessionId:items[0]?.decisionTrace.researchSessionId, scenarioId:items[0]?.decisionTrace.scenarioId, decisionIds:items.map(item=>item.decisionTrace.decisionId), queryCount:measured.metrics.queryCount}));
    return NextResponse.json(measured.value);
  });
}
