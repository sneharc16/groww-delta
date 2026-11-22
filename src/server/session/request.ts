import { boundedBody } from "@/lib/validation/request-body";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCommands } from "@/server/repositories/session-command-repository";
import { AppError } from "@/lib/errors/app-error";
import { apiError } from "@/lib/validation/api";
import { contentHash } from "@/domain/policy/hash";
import { createServices } from "@/server/container";
import { sessionTransaction } from "@/server/repositories/session-transaction";
import { transactionDatabase } from "@/server/repositories/database";
import { createAnonymousSession, findSession, SESSION_MAX_AGE_SECONDS } from "@/server/repositories/session-repository";
import { safeLog } from "@/server/observability/log";

export const SESSION_COOKIE = "delta-session";
type Context = { requestId: string; services: ReturnType<typeof createServices>; userId: string; sessionId: string };
export async function withSession(request: Request, operation: (context: Context) => Promise<NextResponse>, options: { startNew?: boolean } = {}) {
  const requestId = randomUUID(), started = performance.now();
  const path = new URL(request.url).pathname;
  const mutating = !["GET", "HEAD"].includes(request.method);
  let researchSessionId: string | undefined, scenarioId: string | undefined;
  try {
    const origin = request.headers.get("origin");
    if (mutating && ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site"))
      throw new AppError("CROSS_ORIGIN_REQUEST", "Cross-origin mutations are not allowed.", 403);
    const bodyText = mutating ? await boundedBody(request) : "";
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    let session = token && !options.startNew ? await findSession(token) : null;
    if (token && !session && !options.startNew) throw new AppError("SESSION_EXPIRED", "This anonymous session expired. Start a new demo session.", 401);
    if (!session) {
      const created = await createAnonymousSession();
      session = created.session;
      jar.set(SESSION_COOKIE, created.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE_SECONDS });
    }
    researchSessionId = contentHash(session.userId).slice(0, 24);
    const key = mutating ? request.headers.get("idempotency-key") : null;
    if (key && !/^[A-Za-z0-9:_-]{1,128}$/.test(key)) throw new AppError("INVALID_ACTION_KEY", "Invalid idempotency key.", 400);
    const requestHash = contentHash({ method: request.method, path, bodyText, version: request.headers.get("if-match"), position: request.headers.get("x-delta-position"), environment: request.headers.get("x-delta-environment") });
    const currentSession = session;
    const observedPosition = path === "/api/demo/advance" ? await sessionCommands().position(session.demoSessionId) : null;
    const response = await sessionTransaction(currentSession.id, mutating, async tx => {
      const db = transactionDatabase(tx);
      const commands = sessionCommands(db);
      const state = await commands.position(currentSession.demoSessionId);
      scenarioId = state.scenarioId;
      if (key) {
        const receipt = await commands.receipt(currentSession.id, key);
        if (receipt) {
          if (receipt.requestHash !== requestHash) throw new AppError("IDEMPOTENCY_CONFLICT", "This action key was already used with a different request.", 409);
          return NextResponse.json(receipt.response, { status: receipt.status });
        }
      }
      if (observedPosition && (state.currentSequence !== observedPosition.currentSequence || state.generation !== observedPosition.generation || state.scenarioId !== observedPosition.scenarioId))
        throw new AppError("REPLAY_POSITION_CONFLICT", "The replay position changed. Refresh before advancing again.", 409);
      const expectedEnvironment = request.headers.get("x-delta-environment");
      if (expectedEnvironment && expectedEnvironment !== state.scenarioId + ":" + state.generation) throw new AppError("REPLAY_ENVIRONMENT_CONFLICT", "This replay was reset or switched. Refresh before acknowledging or changing it.", 409);
      const expectedPosition = request.headers.get("x-delta-position");
      if (expectedPosition && expectedPosition !== state.scenarioId + ":" + state.generation + ":" + state.currentSequence)
        throw new AppError("REPLAY_POSITION_CONFLICT", "The replay position changed. Refresh before advancing again.", 409);
      const expectedVersion = request.headers.get("if-match");
      if (expectedVersion && request.method === "PATCH") {
        const match = path.match(/^\/api\/watch-intents\/([^/]+)(\/graph)?$/);
        if (match) {
          const logicalId = decodeURIComponent(match[1]);
          const current = await commands.currentVersion(currentSession.userId, logicalId, Boolean(match[2]));
          if (!current || expectedVersion !== String(current.version)) throw new AppError("VERSION_CONFLICT", "This reason changed in another request. Refresh before editing.", 409);
        }
      }
      const result = await operation({ requestId, services: createServices(db, currentSession.demoSessionId), userId: currentSession.userId, sessionId: currentSession.id });
      if (!result.ok) throw new AppError("OPERATION_FAILED", "The operation did not complete.", result.status);
      if (key) await commands.saveReceipt(currentSession.id, key, requestHash, result.status, await result.clone().json());
      return result;
    });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Request-Id", requestId);
    console.info(safeLog({ requestId, operation: request.method + " " + path.replace(/\/watch-intents\/[^/]+/, "/watch-intents/:id"), researchSessionId, scenarioId, latencyMs: performance.now() - started, result: "OK" }));
    return response;
  } catch (error: unknown) {
    console.info(safeLog({ requestId, operation: request.method, researchSessionId, scenarioId, latencyMs: performance.now() - started, result: "ERROR", errorClass: error instanceof AppError ? error.code : error instanceof Error ? error.name : "UnknownError" }));
    const response = apiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Request-Id", requestId);
    return response;
  }
}
