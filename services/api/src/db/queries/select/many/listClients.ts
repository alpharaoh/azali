import { isNull, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { clients, type InsertClient } from "@/db/schema";

export interface ListClientsFilters {
  ids?: string[];
}

export const listClients = async (
  where?: Partial<InsertClient> & ListClientsFilters,
  orderBy?: Partial<Record<keyof InsertClient, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const extraConditions: SQL[] = [isNull(clients.deletedAt)];

  return buildListQuery(clients, {
    where,
    orderBy,
    limit,
    offset,
    extraConditions,
  });
};
