import { and, count, inArray, SQL } from "drizzle-orm";
import { PgTable, TableConfig } from "drizzle-orm/pg-core";
import { buildWhere } from "./buildWhere";
import { buildOrderBy } from "./buildOrderBy";
import { db } from "@/db";

interface ListQueryOptions<TInsert extends Record<string, any>> {
  where?: Partial<TInsert> & { ids?: string[] };
  orderBy?: Partial<Record<keyof TInsert, "asc" | "desc">>;
  limit?: number;
  offset?: number;
  extraConditions?: SQL[];
}

export async function buildListQuery<
  T extends PgTable<TableConfig> & { id: any; $inferSelect: any },
  TInsert extends Record<string, any>,
>(
  table: T,
  options: ListQueryOptions<TInsert> = {},
): Promise<{ data: T["$inferSelect"][]; count: number }> {
  const { where, orderBy, limit, offset, extraConditions = [] } = options;
  const { ids, ...rest } = where || {};

  let whereCondition = and(
    buildWhere(table as any, rest as Partial<TInsert>),
    ...extraConditions,
  );

  if (ids) {
    whereCondition = and(whereCondition, inArray(table.id, ids));
  }

  const dataQuery = db
    .select()
    .from(table as any)
    .where(whereCondition);

  if (orderBy) {
    dataQuery.orderBy(...buildOrderBy(table as any, orderBy));
  }

  if (limit) {
    dataQuery.limit(limit);
  }

  if (offset) {
    dataQuery.offset(offset);
  }

  const countQuery = db
    .select({ count: count() })
    .from(table as any)
    .where(whereCondition);

  const [data, countResult] = await Promise.all([dataQuery, countQuery]);

  return {
    data: data as T["$inferSelect"][],
    count: countResult[0]?.count ?? 0,
  };
}
