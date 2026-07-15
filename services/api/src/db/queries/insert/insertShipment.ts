import { db } from "@/db";
import { embedClient } from "@/db/lib/embedClient";
import { type InsertShipment, shipments } from "@/db/schema";
import { realtimeBus } from "@/realtime/bus";

export const insertShipment = async (values: InsertShipment) => {
  const entry = await db.insert(shipments).values(values).returning();
  if (entry[0]) {
    realtimeBus.emit("shipment.changed", {
      organizationId: entry[0].organizationId,
      shipmentId: entry[0].id,
    });
  }
  return embedClient(entry[0]);
};
