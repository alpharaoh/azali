import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { type InsertShipmentDocument, shipmentDocuments } from "@/db/schema";
import { realtimeBus } from "@/realtime/bus";

export const updateShipmentDocument = async (
  id: string,
  organizationId: string,
  values: Partial<InsertShipmentDocument>,
) => {
  const entry = await db
    .update(shipmentDocuments)
    .set(values)
    .where(
      and(
        eq(shipmentDocuments.id, id),
        eq(shipmentDocuments.organizationId, organizationId),
        isNull(shipmentDocuments.deletedAt),
      ),
    )
    .returning();

  const row = entry[0];
  if (row?.shipmentId) {
    realtimeBus.emit("document.changed", {
      organizationId: row.organizationId,
      shipmentId: row.shipmentId,
      document: {
        id: row.id,
        name: row.fileName,
        status: row.status,
        failureReason: row.failureReason,
      },
    });
  }
  return row;
};
