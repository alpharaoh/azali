import { isNull, type SQL, sql } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { type InsertProduct, products } from "@/db/schema";

export interface ListProductsFilters {
  /** Case-insensitive exact name match. */
  nameEquals?: string;
}

export const listProducts = async (
  where?: Partial<InsertProduct> & ListProductsFilters,
  orderBy?: Partial<Record<keyof InsertProduct, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const { nameEquals, ...rest } = where ?? {};
  const extraConditions: SQL[] = [isNull(products.deletedAt)];

  if (nameEquals) {
    extraConditions.push(sql`lower(${products.name}) = lower(${nameEquals})`);
  }

  return buildListQuery(products, {
    where: rest,
    orderBy: orderBy ?? { createdAt: "desc" },
    limit,
    offset,
    extraConditions,
  });
};
