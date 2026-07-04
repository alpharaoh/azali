import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { env } from "@/env";
import * as schema from "./schema";

neonConfig.webSocketConstructor = WebSocket;
const pool = new Pool({ connectionString: env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

export { db };
