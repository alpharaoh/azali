import { gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { embedClients } from "@/db/lib/embedClient";
import {
  clients,
  type InsertShipment,
  type ShipmentStage,
  type ShipmentStatus,
  shipments,
} from "@/db/schema";

/**
 * Priority rank (1 = most urgent, null = nothing left to do), computed the
 * same way the pipeline board derives it: how much work remains vs. how soon
 * the cargo lands, nudged up for high-value shipments. Kept in SQL so the
 * pipeline can sort by priority across pages.
 */
const hoursUntilArrival = sql`coalesce(extract(epoch from (${shipments.etaAt} - now())) / 3600, 0)`;
const preFiledStagesLeft = sql`(case ${shipments.stage} when 'intake' then 4 when 'classification' then 3 when 'compliance' then 2 else 1 end)`;
const hoursPerStage = sql`(${hoursUntilArrival} / ${preFiledStagesLeft})`;
const basePriority = sql`(case when ${hoursUntilArrival} <= 8 or ${hoursPerStage} < 4 then 1 when ${hoursPerStage} < 12 then 2 when ${hoursPerStage} < 36 then 3 else 4 end)`;
const priorityRank = sql`(case when ${shipments.status} = 'released' or ${shipments.stage} in ('filed', 'released') then null else ${basePriority} - (case when ${shipments.valueCents} >= 10000000 and ${basePriority} > 2 then 1 else 0 end) end)`;

export type ShipmentSortColumn = keyof InsertShipment | "priority";

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
  orderBy?: Partial<Record<ShipmentSortColumn, "asc" | "desc">>,
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

  // Priority is computed, not a column — translate it to raw ORDER BY
  // expressions (actionable shipments first, soonest-arriving as tiebreak).
  const { priority: priorityDir, ...columnOrderBy } = orderBy ?? {};
  const extraOrderBy = priorityDir
    ? [
        priorityDir === "desc"
          ? sql`${priorityRank} desc nulls last`
          : sql`${priorityRank} asc nulls last`,
        sql`${shipments.etaAt} asc nulls last`,
      ]
    : undefined;

  const result = await buildListQuery(shipments, {
    where: rest,
    orderBy: columnOrderBy as Partial<
      Record<keyof InsertShipment, "asc" | "desc">
    >,
    extraOrderBy,
    limit,
    offset,
    extraConditions,
  });

  return { ...result, data: await embedClients(result.data) };
};
