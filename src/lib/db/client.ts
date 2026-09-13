import { recordQuery } from "@/server/observability/database-metrics";
import { validateEnvironment } from "@/lib/validation/environment";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const environment = validateEnvironment(process.env);
  const connectionString = environment.DATABASE_URL;
  // The embedded validation database is run with one connection; regular
  // PostgreSQL keeps a small default pool that deployments can override.
  const adapter = new PrismaPg({ connectionString, max: environment.DATABASE_POOL_SIZE });
  const client = new PrismaClient({ adapter, log: [{ emit: "event", level: "query" }] });
  client.$on("query", event => recordQuery(event.duration));
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
