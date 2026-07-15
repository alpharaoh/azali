import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { embedClient } from "@/db/lib/embedClient";
import { type InsertShipment, shipments } from "@/db/schema";
import { publishShipmentChanged } from "@/realtime/publish";

export const updateShipment = async (
  id: string,
  organizationId: string,
  values: Partial<InsertShipment>,
) => {
  const entry = await db
    .update(shipments)
    .set(values)
    .where(
      and(
        eq(shipments.id, id),
        eq(shipments.organizationId, organizationId),
        isNull(shipments.deletedAt),
      ),
    )
    .returning();

  if (entry[0]) publishShipmentChanged(entry[0]);
  return embedClient(entry[0]);
};
