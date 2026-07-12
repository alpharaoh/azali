import { isNull, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { type InsertShipmentDocument, shipmentDocuments } from "@/db/schema";

export const listShipmentDocuments = async (
  where?: Partial<InsertShipmentDocument>,
  orderBy?: Partial<Record<keyof InsertShipmentDocument, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const extraConditions: SQL[] = [isNull(shipmentDocuments.deletedAt)];

  return buildListQuery(shipmentDocuments, {
    where,
    orderBy: orderBy ?? { createdAt: "asc" },
    limit,
    offset,
    extraConditions,
  });
};
