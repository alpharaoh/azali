import { asc, desc, SQLWrapper } from "drizzle-orm";

export function buildOrderBy<
  InsertRow extends Record<string, any>,
  TableColumns extends Record<keyof InsertRow, any>,
>(
  table: TableColumns,
  orderBy: Partial<Record<keyof InsertRow, "asc" | "desc">>,
) {
  return Object.entries(orderBy).map(([key, direction]) => {
    const column = table[key as keyof TableColumns];
    return direction === "desc"
      ? desc(column as SQLWrapper)
      : asc(column as SQLWrapper);
  });
}
