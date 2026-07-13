import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { type InsertProduct, products } from "@/db/schema";

export const updateProduct = async (
  id: string,
  organizationId: string,
  values: Partial<InsertProduct>,
) => {
  const entry = await db
    .update(products)
    .set(values)
    .where(
      and(
        eq(products.id, id),
        eq(products.organizationId, organizationId),
        isNull(products.deletedAt),
      ),
    )
    .returning();

  return entry[0];
};
