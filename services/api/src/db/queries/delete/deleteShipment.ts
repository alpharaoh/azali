import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { shipments } from "@/db/schema";

export const deleteShipment = async (id: string, organizationId: string) => {
  const entry = await db
    .update(shipments)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(shipments.id, id),
        eq(shipments.organizationId, organizationId),
        isNull(shipments.deletedAt),
      ),
    )
    .returning();

  return entry[0];
};
