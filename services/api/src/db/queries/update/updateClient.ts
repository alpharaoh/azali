import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, type InsertClient } from "@/db/schema";

export const updateClient = async (
  id: string,
  organizationId: string,
  values: Partial<InsertClient>,
) => {
  const entry = await db
    .update(clients)
    .set(values)
    .where(
      and(
        eq(clients.id, id),
        eq(clients.organizationId, organizationId),
        isNull(clients.deletedAt),
      ),
    )
    .returning();

  return entry[0];
};
