import { isNull, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import {
  type InsertLineItemPgaDetermination,
  lineItemPgaDeterminations,
} from "@/db/schema";

export const listLineItemPgaDeterminations = async (
  where?: Partial<InsertLineItemPgaDetermination> & { ids?: string[] },
  orderBy?: Partial<
    Record<keyof InsertLineItemPgaDetermination, "asc" | "desc">
  >,
  limit?: number,
  offset?: number,
) => {
  const extraConditions: SQL[] = [isNull(lineItemPgaDeterminations.deletedAt)];

  return buildListQuery(lineItemPgaDeterminations, {
    where,
    orderBy: orderBy ?? { createdAt: "asc" },
    limit,
    offset,
    extraConditions,
  });
};
