import { eq } from "drizzle-orm";
import { db } from "@/db";
import { type InsertShipmentDocument, shipmentDocuments } from "@/db/schema";
import { realtimeBus } from "@/realtime/bus";

export const insertShipmentDocument = async (
  values: InsertShipmentDocument,
) => {
  const entry = await db
    .insert(shipmentDocuments)
    .values(values)
    // Ingestion events can be re-delivered — the stored object is the
    // identity, so a duplicate insert returns the existing row untouched.
    .onConflictDoNothing({ target: shipmentDocuments.storageKey })
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
  if (row) return row;

  const existing = await db
    .select()
    .from(shipmentDocuments)
    .where(eq(shipmentDocuments.storageKey, values.storageKey))
    .limit(1);

  return existing[0];
};
