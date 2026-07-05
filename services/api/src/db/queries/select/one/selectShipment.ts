import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { shipments } from "@/db/schema";

export const selectShipment = async (id: string, organizationId: string) => {
  const entry = await db
    .select()
    .from(shipments)
    .where(
      and(
        eq(shipments.id, id),
        eq(shipments.organizationId, organizationId),
        isNull(shipments.deletedAt),
      ),
    )
    .limit(1);

  return entry[0];
};
