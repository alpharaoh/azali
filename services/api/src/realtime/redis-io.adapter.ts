import type { Server as HttpServer } from "node:http";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import type { ServerOptions } from "socket.io";
import { createLogger } from "@/lib/logger";

const log = createLogger("realtime-redis");

/**
 * socket.io adapter that relays room broadcasts across API instances via
 * Redis pub/sub when REDIS_URL is set — required for horizontal scaling,
 * since an Inngest run executes on one instance while the viewer's socket
 * may live on another. Without REDIS_URL it is a plain in-memory adapter
 * (single instance / local dev needs no Redis).
 *
 * Redis is purely ephemeral transport here: a dropped broadcast is healed
 * by the client's DB-backed initial fetch and reconnect invalidation sweep.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  // Takes the raw HTTP server, NOT the Nest app: the base adapter detects
  // the app via `instanceof NestApplication`, which fails under bun's
  // isolated installs (@nestjs/websockets resolves its own @nestjs/core
  // copy) — engine.io would then try to attach to the Nest app object.
  constructor(httpServer: HttpServer) {
    super(httpServer);
  }

  async connectToRedis(url: string): Promise<void> {
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();
    // Without these, a dropped Redis connection raises an unhandled
    // "error" event and kills the process mid-flight.
    pubClient.on("error", (error) =>
      log.error({ err: error }, "redis pub connection error"),
    );
    subClient.on("error", (error) =>
      log.error({ err: error }, "redis sub connection error"),
    );
    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
    } catch (error) {
      throw new Error(
        `REDIS_URL is set but unreachable (${error instanceof Error ? error.message : error}). ` +
          "Fix the URL, or unset REDIS_URL to run with in-process broadcasts " +
          "(fine for a single API instance / local dev). Note: provider-internal " +
          "hostnames (e.g. Render's red-*) only resolve inside their network.",
        { cause: error },
      );
    }
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
