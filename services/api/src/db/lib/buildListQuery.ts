import { and, count, inArray, type SQL } from "drizzle-orm";
import type { PgTable, TableConfig } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { buildOrderBy } from "./buildOrderBy";
import { buildWhere } from "./buildWhere";

interface ListQueryOptions<TInsert extends Record<string, any>> {
  where?: Partial<TInsert> & { ids?: string[] };
  orderBy?: Partial<Record<keyof TInsert, "asc" | "desc">>;
  /** Raw ORDER BY expressions for computed sorts; takes precedence over orderBy. */
  extraOrderBy?: SQL[];
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
  const { where, orderBy, extraOrderBy, limit, offset, extraConditions = [] } =
    options;
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

  if (extraOrderBy?.length) {
    dataQuery.orderBy(...extraOrderBy);
  } else if (orderBy) {
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
