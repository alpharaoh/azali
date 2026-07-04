import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";

export const selectClient = async (id: string, organizationId: string) => {
  const entry = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.id, id),
        eq(clients.organizationId, organizationId),
        isNull(clients.deletedAt),
      ),
    )
    .limit(1);

  return entry[0];
};
