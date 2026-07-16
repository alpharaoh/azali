import { db } from "@/db";
import { embedClient } from "@/db/lib/embedClient";
import { type InsertShipment, shipments } from "@/db/schema";

export const insertShipment = async (values: InsertShipment) => {
  const entry = await db.insert(shipments).values(values).returning();
  return embedClient(entry[0]);
};
