import { isNull, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { type InsertShipmentLineItem, shipmentLineItems } from "@/db/schema";

export const listShipmentLineItems = async (
  where?: Partial<InsertShipmentLineItem>,
  limit?: number,
  offset?: number,
) => {
  const extraConditions: SQL[] = [isNull(shipmentLineItems.deletedAt)];

  return buildListQuery(shipmentLineItems, {
    where,
    orderBy: { lineNumber: "asc" },
    limit,
    offset,
    extraConditions,
  });
};
