import { gte, ilike, inArray, isNull, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { buildListQuery } from "@/db/lib/buildListQuery";
import {
  clients,
  type InsertShipment,
  type ShipmentStage,
  type ShipmentStatus,
  shipments,
} from "@/db/schema";

export interface ListShipmentsFilters {
  ids?: string[];
  stages?: ShipmentStage[];
  statuses?: ShipmentStatus[];
  clientIds?: string[];
  reviewTypes?: string[];
  valueMinCents?: number;
  valueMaxCents?: number;
  search?: string;
}

export const listShipments = async (
  where?: Partial<InsertShipment> & ListShipmentsFilters,
  orderBy?: Partial<Record<keyof InsertShipment, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const {
    stages,
    statuses,
    clientIds,
    reviewTypes,
    valueMinCents,
    valueMaxCents,
    search,
    ...rest
  } = where ?? {};
  const extraConditions: SQL[] = [isNull(shipments.deletedAt)];

  if (stages?.length) {
    extraConditions.push(inArray(shipments.stage, stages));
  }
  if (statuses?.length) {
    extraConditions.push(inArray(shipments.status, statuses));
  }
  if (clientIds?.length) {
    extraConditions.push(inArray(shipments.clientId, clientIds));
  }
  if (reviewTypes?.length) {
    extraConditions.push(inArray(shipments.reviewType, reviewTypes));
  }
  if (valueMinCents !== undefined) {
    extraConditions.push(gte(shipments.valueCents, valueMinCents));
  }
  if (valueMaxCents !== undefined) {
    extraConditions.push(lte(shipments.valueCents, valueMaxCents));
  }
  if (search) {
    const pattern = `%${search}%`;
    const condition = or(
      ilike(shipments.reference, pattern),
      ilike(shipments.entryNumber, pattern),
      // Match by client name via subquery — buildListQuery is single-table.
      inArray(
        shipments.clientId,
        db
          .select({ id: clients.id })
          .from(clients)
          .where(ilike(clients.name, pattern)),
      ),
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
