import { isNull, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { type InsertShipmentLineItem, shipmentLineItems } from "@/db/schema";

export const listShipmentLineItems = async (
  where?: Partial<InsertShipmentLineItem> & { ids?: string[] },
  orderBy?: Partial<Record<keyof InsertShipmentLineItem, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const extraConditions: SQL[] = [isNull(shipmentLineItems.deletedAt)];

  return buildListQuery(shipmentLineItems, {
    where,
    orderBy: orderBy ?? { lineNumber: "asc" },
    limit,
    offset,
    extraConditions,
  });
};
