import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";

export interface EmbeddedClient {
  id: string;
  name: string;
  image: string | null;
}

/**
 * Attaches the owning client (id/name/image) to shipment rows so consumers
 * don't need a second clients request just to label rows. Deleted clients are
 * still resolved — their name remains useful on historical shipments.
 */
export async function embedClients<T extends { clientId: string }>(
  rows: T[],
): Promise<Array<T & { client: EmbeddedClient | null }>> {
  const ids = [...new Set(rows.map((row) => row.clientId))];
  const found = ids.length
    ? await db
        .select({ id: clients.id, name: clients.name, image: clients.image })
        .from(clients)
        .where(inArray(clients.id, ids))
    : [];
  const byId = new Map(found.map((client) => [client.id, client]));

  return rows.map((row) => ({
    ...row,
    client: byId.get(row.clientId) ?? null,
  }));
}

export async function embedClient<T extends { clientId: string }>(
  row: T | undefined,
): Promise<(T & { client: EmbeddedClient | null }) | undefined> {
  if (!row) return undefined;
  const [withClient] = await embedClients([row]);

  return withClient;
}
