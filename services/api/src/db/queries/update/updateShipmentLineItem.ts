import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { type InsertShipmentLineItem, shipmentLineItems } from "@/db/schema";
import { publishLineChanged } from "@/realtime/publish";

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

  if (entry[0]) publishLineChanged(entry[0]);
  return entry[0];
};
