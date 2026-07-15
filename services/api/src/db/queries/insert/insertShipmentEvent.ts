import { db } from "@/db";
import { type InsertShipmentEvent, shipmentEvents } from "@/db/schema";
import { realtimeBus } from "@/realtime/bus";

export const insertShipmentEvent = async (values: InsertShipmentEvent) => {
  const entry = await db.insert(shipmentEvents).values(values).returning();
  const row = entry[0];
  if (row) {
    realtimeBus.emit("shipment.event", {
      organizationId: row.organizationId,
      shipmentId: row.shipmentId,
      event: {
        id: row.id,
        type: row.type,
        actor: row.actor,
        title: row.title,
        occurredAt: row.occurredAt.toISOString(),
        payload: row.payload,
      },
    });
  }
  return row;
};
