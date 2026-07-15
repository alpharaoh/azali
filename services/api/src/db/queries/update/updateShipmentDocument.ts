import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { type InsertShipmentDocument, shipmentDocuments } from "@/db/schema";
import { publishDocumentChanged } from "@/realtime/publish";

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
  if (row?.shipmentId)
    publishDocumentChanged({ ...row, shipmentId: row.shipmentId });
  return row;
};
