import { db } from "@/db";
import { type InsertShipmentEvent, shipmentEvents } from "@/db/schema";

export const insertShipmentEvent = async (values: InsertShipmentEvent) => {
  const entry = await db.insert(shipmentEvents).values(values).returning();
  return entry[0];
};
