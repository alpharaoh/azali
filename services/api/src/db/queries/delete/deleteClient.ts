import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";

export const deleteClient = async (id: string, organizationId: string) => {
  const entry = await db
    .update(clients)
    .set({ deletedAt: new Date() })
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
