import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shipmentLineItems } from "@/db/schema";

/** Hard-delete a shipment's line items — used by re-ingestion to replace
 * the full line set rather than append duplicates. */
export const deleteShipmentLineItems = async (
  shipmentId: string,
  organizationId: string,
) => {
  return db
    .delete(shipmentLineItems)
    .where(
      and(
        eq(shipmentLineItems.shipmentId, shipmentId),
        eq(shipmentLineItems.organizationId, organizationId),
      ),
    );
};
