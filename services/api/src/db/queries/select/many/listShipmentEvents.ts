import { inArray, isNull, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { type InsertShipmentEvent, shipmentEvents } from "@/db/schema";

export interface ListShipmentEventsFilters {
  ids?: string[];
  types?: string[];
  actors?: string[];
}

// Events are append-only: there are deliberately no update/delete queries.
export const listShipmentEvents = async (
  where?: Partial<InsertShipmentEvent> & ListShipmentEventsFilters,
  orderBy?: Partial<Record<keyof InsertShipmentEvent, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const { types, actors, ...rest } = where ?? {};
  const extraConditions: SQL[] = [isNull(shipmentEvents.deletedAt)];

  if (types?.length) {
    extraConditions.push(inArray(shipmentEvents.type, types));
  }
  if (actors?.length) {
    extraConditions.push(inArray(shipmentEvents.actor, actors));
  }

  return buildListQuery(shipmentEvents, {
    where: rest,
    orderBy: orderBy ?? { occurredAt: "desc" },
    limit,
    offset,
    extraConditions,
  });
};
