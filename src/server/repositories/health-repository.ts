import { prisma } from "@/lib/db/client";
export async function databaseSchemaCompatible(expectedMigration: string) {
  await prisma.$queryRaw`SELECT 1`;
  const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  return migrations.some(row => row.migration_name === expectedMigration);
}
