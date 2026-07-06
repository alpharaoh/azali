import { drizzle } from "drizzle-orm/bun-sql";
import { env } from "@/env";
import * as schema from "./schema";

// Bun's SQL client forwards sslrootcert to the server as a startup parameter,
// which Postgres rejects. Bun uses the system trust store by default anyway.
const url = new URL(env.DATABASE_URL);
url.searchParams.delete("sslrootcert");

export const db = drizzle({
  // PlanetScale Postgres has a small connection limit; Bun.SQL's default pool
  // of 10 per process (dev server + every seed/script) exhausts it fast.
  // Without connectionTimeout a starved pool waits forever — requests (e.g.
  // get-session) hang instead of erroring.
  // Do NOT set idleTimeout/maxLifetime here: Bun's pool closes those
  // connections abruptly and queries racing onto them fail with
  // "Idle timeout reached after 30s".
  connection: {
    max: 3,
    url: url.toString(),
    connectionTimeout: 10,
  },
  schema,
});
