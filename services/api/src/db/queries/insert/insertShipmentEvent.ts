import { db } from "@/db";
import { type InsertShipmentEvent, shipmentEvents } from "@/db/schema";
import { publishShipmentEvent } from "@/realtime/publish";

export const insertShipmentEvent = async (values: InsertShipmentEvent) => {
  const entry = await db.insert(shipmentEvents).values(values).returning();
  if (entry[0]) publishShipmentEvent(entry[0]);
  return entry[0];
};
