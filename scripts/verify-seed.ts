import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { prisma } from "../src/lib/db/client";

async function counts() {
  return {
    users: await prisma.user.count(), instruments: await prisma.instrument.count(),
    watchlists: await prisma.watchlist.count(), items: await prisma.watchlistItem.count(),
    intents: await prisma.watchIntent.count(), graphs: await prisma.watchGraph.count(),
    nodes: await prisma.watchGraphNode.count(), edges: await prisma.watchGraphEdge.count(),
    events: await prisma.marketEvent.count(), snapshots: await prisma.marketSnapshot.count(),
    cursors: await prisma.knowledgeCursor.count(), acknowledgements: await prisma.knowledgeAcknowledgement.count(),
    reviews: await prisma.corporateActionReview.count(),
  };
}
try {
  const before = await counts();
  const state = await prisma.demoSession.findMany();
  for (let run = 1; run <= 2; run++) {
    const result = spawnSync("corepack", ["pnpm", "db:seed"], { stdio: "inherit", env: process.env });
    assert.equal(result.status, 0, `Seed run ${run} failed`);
    assert.deepEqual(await counts(), before, "Seeding duplicated or removed existing rows");
    assert.deepEqual(await prisma.demoSession.findMany(), state, "Seeding changed persisted demo state");
  }
  console.log("PASS: seed twice, unchanged counts/state", before);
} finally { await prisma.$disconnect(); }
