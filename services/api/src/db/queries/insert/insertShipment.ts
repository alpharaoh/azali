import { db } from "@/db";
import { type InsertShipment, shipments } from "@/db/schema";

export const insertShipment = async (values: InsertShipment) => {
  const entry = await db.insert(shipments).values(values).returning();
  return entry[0];
};
