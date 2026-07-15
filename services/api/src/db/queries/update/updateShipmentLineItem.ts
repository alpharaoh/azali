import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { type InsertShipmentLineItem, shipmentLineItems } from "@/db/schema";
import { realtimeBus } from "@/realtime/bus";

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

  const row = entry[0];
  if (row) {
    realtimeBus.emit("line.changed", {
      organizationId: row.organizationId,
      shipmentId: row.shipmentId,
      line: {
        id: row.id,
        lineNumber: row.lineNumber,
        status: row.status,
        htsCode: row.htsCode,
        confidence: row.confidence,
      },
    });
  }
  return row;
};
