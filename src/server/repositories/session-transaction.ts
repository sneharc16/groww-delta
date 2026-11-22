import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
/** Every HTTP command and its nested repositories share one transaction and session lock. */
export function sessionTransaction<T>(sessionId: string, mutating: boolean, operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async tx => {
    if (mutating) await tx.$queryRaw`SELECT "id" FROM "AnonymousSession" WHERE "id" = ${sessionId} FOR UPDATE`;
    return operation(tx);
  }, { isolationLevel: mutating ? "ReadCommitted" : "RepeatableRead", timeout: 20_000, maxWait: 10_000 });
}
