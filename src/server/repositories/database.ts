import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
/** Nested service operations participate in the outer request transaction. */
export type Database = Prisma.TransactionClient & {
  $transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};
export const database: Database = prisma;
export function transactionDatabase(transaction: Prisma.TransactionClient): Database {
  return new Proxy(transaction as Database, {
    get(target, key) {
      if (key === "$transaction") return <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) => operation(transaction);
      return Reflect.get(target, key);
    },
  });
}
