import { db } from "@/db";
import { type InsertShipmentLineItem, shipmentLineItems } from "@/db/schema";
import { realtimeBus } from "@/realtime/bus";

/** Lines arrive as a batch per shipment. */
export const insertShipmentLineItems = async (
  values: InsertShipmentLineItem[],
) => {
  if (values.length === 0) return [];
  const rows = await db.insert(shipmentLineItems).values(values).returning();
  for (const row of rows) {
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
  return rows;
};
