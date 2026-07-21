import { poolStats } from "@/db";
import { createLogger } from "@/lib/logger";

// Structural types instead of fastify's: @nestjs/platform-fastify pins its
// own fastify copy, and the two copies' FastifyInstance types don't unify.
type WatchdogRequest = { method: string; url: string };
type WatchdogServer = {
  addHook(
    name: "onRequest" | "onResponse",
    hook: (request: WatchdogRequest, reply: unknown, done: () => void) => void,
  ): unknown;
  addHook(
    name: "onRequestAbort",
    hook: (request: WatchdogRequest, done: () => void) => void,
  ): unknown;
};

const logger = createLogger("watchdog");

const PENDING_THRESHOLD_MS = 10_000;
const SWEEP_INTERVAL_MS = 15_000;

/**
 * Logs every request that stays in flight past PENDING_THRESHOLD_MS, with
 * db pool occupancy attached — distinguishes "pool starved" (waiting > 0,
 * idle 0) from "hang is elsewhere" (pool idle) without needing a debugger
 * on a wedged production process.
 */
export function registerRequestWatchdog(fastify: WatchdogServer) {
  const inFlight = new Map<
    object,
    { method: string; url: string; startedAt: number; reported: boolean }
  >();

  fastify.addHook("onRequest", (request, _reply, done) => {
    inFlight.set(request, {
      method: request.method,
      url: request.url,
      startedAt: Date.now(),
      reported: false,
    });
    done();
  });

  const finish = (request: object) => {
    const entry = inFlight.get(request);
    if (entry?.reported) {
      logger.warn(
        { method: entry.method, url: entry.url, pool: poolStats() },
        `slow request finally completed after ${Date.now() - entry.startedAt}ms`,
      );
    }
    inFlight.delete(request);
  };
  fastify.addHook("onResponse", (request, _reply, done) => {
    finish(request);
    done();
  });
  fastify.addHook("onRequestAbort", (request, done) => {
    finish(request);
    done();
  });

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const entry of inFlight.values()) {
      if (now - entry.startedAt < PENDING_THRESHOLD_MS) {
        continue;
      }
      logger.warn(
        {
          method: entry.method,
          url: entry.url,
          pendingMs: now - entry.startedAt,
          pool: poolStats(),
        },
        "request pending",
      );
      entry.reported = true;
    }
  }, SWEEP_INTERVAL_MS);
  // Never keep the process alive just to sweep.
  sweep.unref?.();
}
