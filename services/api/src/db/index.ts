import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "@/env";
import { createLogger } from "@/lib/logger";
import * as schema from "./schema";

const logger = createLogger("db");

// node-postgres treats `sslrootcert=system` (PlanetScale's recommended param)
// as a literal file path and crashes. `sslmode=verify-full` alone still fully
// verifies the server against Node's built-in CA store.
const url = new URL(env.DATABASE_URL);
if (url.searchParams.get("sslrootcert") === "system") {
  url.searchParams.delete("sslrootcert");
}

// node-postgres instead of Bun.SQL: Bun's client has open connection-lifecycle
// bugs that leave requests pending forever against a remote DB — a query
// promise can be silently lost (oven-sh/bun#27362, #26235), idle/lifetime
// timers hard-fail in-flight queries (#30646), and the pool `max` isn't
// enforced (#23215). pg retires idle connections gracefully and query_timeout
// guarantees a hung socket surfaces as an error instead of a pending request.
export const db = drizzle({
  connection: {
    connectionString: url.toString(),
    // PlanetScale's PgBouncer (port 6432) multiplexes these onto a small
    // shared backend pool; 5 client connections per process is plenty and
    // leaves headroom for seeds/scripts running alongside the dev server.
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    // Detect silently-dropped sockets (NAT/LB idle kills, failovers) instead
    // of waiting on TCP retransmission timeouts.
    keepAlive: true,
    // Client-side per-query ceiling — no query may pend indefinitely.
    query_timeout: 30_000,
    // Hard cap on connection age. A connection poisoned by a timed-out query
    // or silently killed upstream can otherwise recirculate forever; pg
    // retires aged connections gracefully (only once idle), unlike Bun.SQL.
    maxLifetimeSeconds: 300,
  },
  schema,
});

/** The underlying pg Pool — exposed for diagnostics and shutdown. */
export const pool = db.$client;

// A remotely-dropped idle connection (failover, LB idle kill) surfaces as an
// 'error' event on the pool; without a listener that's an uncaught exception.
pool.on("error", (error) => {
  logger.error({ err: error }, "idle connection dropped");
});

// Steady-state churn here is diagnostic gold: bursts of removals right after
// 30s-latency errors mean timed-out queries are poisoning connections.
pool.on("remove", () => {
  logger.info(poolStats(), "connection removed from pool");
});

/** Point-in-time pool occupancy, for hang diagnostics. */
export function poolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}
