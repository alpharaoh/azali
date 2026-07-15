import { db } from "@/db";
import { type InsertShipmentLineItem, shipmentLineItems } from "@/db/schema";
import { publishLineChanged } from "@/realtime/publish";

/** Lines arrive as a batch per shipment. */
export const insertShipmentLineItems = async (
  values: InsertShipmentLineItem[],
) => {
  if (values.length === 0) return [];
  const rows = await db.insert(shipmentLineItems).values(values).returning();
  for (const row of rows) publishLineChanged(row);
  return rows;
};
