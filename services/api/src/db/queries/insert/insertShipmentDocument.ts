import { eq } from "drizzle-orm";
import { db } from "@/db";
import { type InsertShipmentDocument, shipmentDocuments } from "@/db/schema";

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

  if (entry[0]) return entry[0];

  const existing = await db
    .select()
    .from(shipmentDocuments)
    .where(eq(shipmentDocuments.storageKey, values.storageKey))
    .limit(1);

  return existing[0];
};
