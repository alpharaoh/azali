import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { shipmentDocuments } from "@/db/schema";

export const selectShipmentDocument = async (
  id: string,
  organizationId: string,
) => {
  const entry = await db
    .select()
    .from(shipmentDocuments)
    .where(
      and(
        eq(shipmentDocuments.id, id),
        eq(shipmentDocuments.organizationId, organizationId),
        isNull(shipmentDocuments.deletedAt),
      ),
    )
    .limit(1);

  return entry[0];
};
