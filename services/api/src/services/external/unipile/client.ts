import { UnipileClient } from "unipile-node-sdk";
import { env } from "@/env";

let client: UnipileClient | null = null;

/**
 * Lazy singleton — the API boots without Unipile credentials; email
 * ingestion fails with a clear error at the point of use instead.
 */
export function getUnipileClient(): UnipileClient {
  if (!env.UNIPILE_DSN || !env.UNIPILE_API_KEY) {
    throw new Error(
      "UNIPILE_DSN / UNIPILE_API_KEY are not set — add them to services/api/.env to enable email ingestion",
    );
  }
  client ??= new UnipileClient(
    `https://${env.UNIPILE_DSN}`,
    env.UNIPILE_API_KEY,
  );
  return client;
}
