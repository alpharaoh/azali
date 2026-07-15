import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { embedClient } from "@/db/lib/embedClient";
import { shipments } from "@/db/schema";
import { realtimeBus } from "@/realtime/bus";

export const deleteShipment = async (id: string, organizationId: string) => {
  const entry = await db
    .update(shipments)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(shipments.id, id),
        eq(shipments.organizationId, organizationId),
        isNull(shipments.deletedAt),
      ),
    )
    .returning();

  if (entry[0]) {
    realtimeBus.emit("shipment.changed", {
      organizationId,
      shipmentId: entry[0].id,
    });
  }
  return embedClient(entry[0]);
};
