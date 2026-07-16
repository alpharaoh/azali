import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { type InsertShipmentLineItem, shipmentLineItems } from "@/db/schema";

export const updateShipmentLineItem = async (
  id: string,
  organizationId: string,
  values: Partial<InsertShipmentLineItem>,
) => {
  const entry = await db
    .update(shipmentLineItems)
    .set(values)
    .where(
      and(
        eq(shipmentLineItems.id, id),
        eq(shipmentLineItems.organizationId, organizationId),
        isNull(shipmentLineItems.deletedAt),
      ),
    )
    .returning();

  return entry[0];
};
