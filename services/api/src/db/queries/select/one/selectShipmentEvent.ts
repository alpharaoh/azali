import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { shipmentEvents } from "@/db/schema";

export const selectShipmentEvent = async (
  id: string,
  organizationId: string,
) => {
  const entry = await db
    .select()
    .from(shipmentEvents)
    .where(
      and(
        eq(shipmentEvents.id, id),
        eq(shipmentEvents.organizationId, organizationId),
        isNull(shipmentEvents.deletedAt),
      ),
    )
    .limit(1);

  return entry[0];
};
