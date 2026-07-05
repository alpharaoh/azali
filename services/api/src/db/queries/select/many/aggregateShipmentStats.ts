import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { shipments } from "@/db/schema";

/** Org-wide shipment counts grouped by status and review type. */
export const aggregateShipmentStats = async (organizationId: string) => {
  return db
    .select({
      count: count(),
      reviewType: shipments.reviewType,
      status: shipments.status,
    })
    .from(shipments)
    .where(
      and(
        eq(shipments.organizationId, organizationId),
        isNull(shipments.deletedAt),
      ),
    )
    .groupBy(shipments.status, shipments.reviewType);
};
