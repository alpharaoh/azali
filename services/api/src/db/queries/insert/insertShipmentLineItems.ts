import { db } from "@/db";
import { type InsertShipmentLineItem, shipmentLineItems } from "@/db/schema";

/** Lines arrive as a batch per shipment. */
export const insertShipmentLineItems = async (
  values: InsertShipmentLineItem[],
) => {
  if (values.length === 0) return [];
  return db.insert(shipmentLineItems).values(values).returning();
};
