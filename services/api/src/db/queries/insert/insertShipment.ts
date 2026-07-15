import { db } from "@/db";
import { embedClient } from "@/db/lib/embedClient";
import { type InsertShipment, shipments } from "@/db/schema";
import { publishShipmentChanged } from "@/realtime/publish";

export const insertShipment = async (values: InsertShipment) => {
  const entry = await db.insert(shipments).values(values).returning();
  if (entry[0]) publishShipmentChanged(entry[0]);
  return embedClient(entry[0]);
};
