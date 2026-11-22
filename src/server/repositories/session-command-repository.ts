import type { Prisma } from "@/generated/prisma/client";
import { database, type Database } from "./database";
/** Persistence used by the HTTP transaction/precondition coordinator, not domain policy. */
export function sessionCommands(db: Database = database) {
  return {
    position: (id: string) => db.demoSession.findUniqueOrThrow({ where: { id } }),
    receipt: (sessionId: string, key: string) => db.mutationReceipt.findUnique({ where: { sessionId_key: { sessionId, key } } }),
    currentVersion: (userId: string, logicalId: string, graph: boolean) => graph
      ? db.watchGraph.findFirst({ where: { userId, watchIntentLogicalId: logicalId, status: "ACTIVE" }, select: { version: true } })
      : db.watchIntent.findFirst({ where: { userId, logicalIntentId: logicalId, status: "ACTIVE" }, select: { version: true } }),
    saveReceipt: (sessionId: string, key: string, requestHash: string, status: number, response: unknown) => db.mutationReceipt.create({
      data: { sessionId, key, requestHash, status, response: response as Prisma.InputJsonValue },
    }),
  };
}
