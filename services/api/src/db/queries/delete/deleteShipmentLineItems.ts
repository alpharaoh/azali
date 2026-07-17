import { db } from "@/db";
import { buildWhere } from "@/db/lib/buildWhere";
import { type InsertShipmentLineItem, shipmentLineItems } from "@/db/schema";

/** Hard-delete line items matching `where` — used by re-ingestion to
 * replace a shipment's full line set rather than append duplicates. */
export const deleteShipmentLineItems = async (
  where: Partial<InsertShipmentLineItem>,
) => {
  if (Object.values(where).every((value) => value === undefined)) {
    throw new Error("deleteShipmentLineItems requires a non-empty where");
  }
  return db
    .delete(shipmentLineItems)
    .where(buildWhere(shipmentLineItems, where));
};
