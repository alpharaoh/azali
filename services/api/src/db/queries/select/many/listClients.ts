import { ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import {
  type ClientAutonomy,
  type ClientStatus,
  clients,
  type InsertClient,
} from "@/db/schema";

export interface ListClientsFilters {
  ids?: string[];
  statuses?: ClientStatus[];
  autonomies?: ClientAutonomy[];
  search?: string;
}

export const listClients = async (
  where?: Partial<InsertClient> & ListClientsFilters,
  orderBy?: Partial<Record<keyof InsertClient, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const { statuses, autonomies, search, ...rest } = where ?? {};
  const extraConditions: SQL[] = [isNull(clients.deletedAt)];

  if (statuses?.length) {
    extraConditions.push(inArray(clients.status, statuses));
  }
  if (autonomies?.length) {
    extraConditions.push(inArray(clients.autonomy, autonomies));
  }
  if (search) {
    const pattern = `%${search}%`;
    const condition = or(
      ilike(clients.name, pattern),
      ilike(clients.iorNumber, pattern),
      ilike(clients.bondNumber, pattern),
    );
    if (condition) {
      extraConditions.push(condition);
    }
  }

  return buildListQuery(clients, {
    where: rest,
    orderBy,
    limit,
    offset,
    extraConditions,
  });
};
