import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db/client";
import { PrismaKnowledgeCursorRepository } from "../src/server/repositories/prisma-repositories";

// Uses a uniquely-owned test user; never resets or deletes application data.
const userId = `build4-db-test-${randomUUID()}`;
const cursors = new PrismaKnowledgeCursorRepository();
try {
  await prisma.user.create({ data: { id: userId, displayName: "Build 4 transaction test" } });
  const snapshot = await prisma.marketSnapshot.findFirstOrThrow({ where: { instrumentId: "NSE:TCS", sequence: 0, scenarioId: "groww-delta-default" } });
  await cursors.setBaseline(userId, { instrumentId: "NSE:TCS", sequence: 10, eventTime: snapshot.eventTime, snapshotId: snapshot.id });
  const command = (sequence: number) => ({ instrumentId: "NSE:TCS", sequence, eventTime: snapshot.eventTime, snapshotId: snapshot.id });
  await Promise.all([cursors.acknowledgeMany(userId, [command(12)], "INSTRUMENT"), cursors.acknowledgeMany(userId, [command(11)], "INSTRUMENT")]);
  const current = (await cursors.listForInstruments(userId, ["NSE:TCS"]))[0];
  assert.equal(current.lastSeenSequence, 12);
  const history = await prisma.knowledgeAcknowledgement.findMany({ where: { userId }, orderBy: { throughSequence: "asc" } });
  assert.equal(history.at(-1)?.throughSequence, 12);
  assert.equal(history[0].fromSequence, 10);
  assert.equal(current.cursorVersion, history.length + 1);
  await cursors.acknowledgeMany(userId, [command(11)], "INSTRUMENT");
  assert.equal((await cursors.listForInstruments(userId, ["NSE:TCS"]))[0].cursorVersion, current.cursorVersion);
  assert.equal(await prisma.knowledgeAcknowledgement.count({ where: { userId } }), history.length);
  // Fail after the first cursor/history write to prove whole-command rollback.
  await assert.rejects(() => cursors.acknowledgeMany(userId, [command(13), { ...command(13), instrumentId: "ZZZ:MISSING" }], "WATCHLIST"));
  assert.equal((await cursors.listForInstruments(userId, ["NSE:TCS"]))[0].lastSeenSequence, 12);
  assert.equal(await prisma.knowledgeAcknowledgement.count({ where: { userId } }), history.length);
  console.log("PASS: concurrent/stale monotonic writes, cursorVersion, atomic history, and rollback.");
} finally {
  await prisma.knowledgeAcknowledgement.deleteMany({ where: { userId } });
  await prisma.knowledgeCursor.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
}
