import { ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import {
  type InsertShipment,
  type ShipmentStage,
  type ShipmentStatus,
  shipments,
} from "@/db/schema";

export interface ListShipmentsFilters {
  ids?: string[];
  stages?: ShipmentStage[];
  statuses?: ShipmentStatus[];
  search?: string;
}

export const listShipments = async (
  where?: Partial<InsertShipment> & ListShipmentsFilters,
  orderBy?: Partial<Record<keyof InsertShipment, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const { stages, statuses, search, ...rest } = where ?? {};
  const extraConditions: SQL[] = [isNull(shipments.deletedAt)];

  if (stages?.length) {
    extraConditions.push(inArray(shipments.stage, stages));
  }
  if (statuses?.length) {
    extraConditions.push(inArray(shipments.status, statuses));
  }
  if (search) {
    const pattern = `%${search}%`;
    const condition = or(
      ilike(shipments.reference, pattern),
      ilike(shipments.entryNumber, pattern),
    );
    if (condition) {
      extraConditions.push(condition);
    }
  }

  return buildListQuery(shipments, {
    where: rest,
    orderBy,
    limit,
    offset,
    extraConditions,
  });
};
