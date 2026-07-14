import {
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { embedClients } from "@/db/lib/embedClient";
import { clients, type InsertProduct, products } from "@/db/schema";

export interface ListProductsFilters {
  /** Case-insensitive exact name match. */
  nameEquals?: string;
  /** Only products with a classification — the knowledge base view. */
  classifiedOnly?: boolean;
  clientIds?: string[];
  sources?: string[];
  /** Free-text match on name, SKU, HTS code, or client name. */
  search?: string;
}

export const listProducts = async (
  where?: Partial<InsertProduct> & ListProductsFilters,
  orderBy?: Partial<Record<keyof InsertProduct, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const { nameEquals, classifiedOnly, clientIds, sources, search, ...rest } =
    where ?? {};
  const extraConditions: SQL[] = [isNull(products.deletedAt)];

  if (nameEquals) {
    extraConditions.push(sql`lower(${products.name}) = lower(${nameEquals})`);
  }
  if (classifiedOnly) {
    extraConditions.push(isNotNull(products.htsCode));
  }
  if (clientIds?.length) {
    extraConditions.push(inArray(products.clientId, clientIds));
  }
  if (sources?.length) {
    extraConditions.push(inArray(products.source, sources));
  }
  if (search) {
    const pattern = `%${search}%`;
    const condition = or(
      ilike(products.name, pattern),
      ilike(products.sku, pattern),
      ilike(products.htsCode, pattern),
      // Match by client name via subquery — buildListQuery is single-table.
      inArray(
        products.clientId,
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

  const result = await buildListQuery(products, {
    where: rest,
    orderBy: orderBy ?? { createdAt: "desc" },
    limit,
    offset,
    extraConditions,
  });

  return { ...result, data: await embedClients(result.data) };
};
