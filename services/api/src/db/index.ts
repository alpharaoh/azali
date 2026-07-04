import { drizzle } from "drizzle-orm/bun-sql";
import { env } from "@/env";
import * as schema from "./schema";

// Bun's SQL client forwards sslrootcert to the server as a startup parameter,
// which Postgres rejects. Bun uses the system trust store by default anyway.
const url = new URL(env.DATABASE_URL);
url.searchParams.delete("sslrootcert");

export const db = drizzle({ connection: url.toString(), schema });
