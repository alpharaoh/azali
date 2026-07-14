import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";

/** Atomic hit-counter bump — one reused shipment line = one hit. */
export const incrementProductReuse = async (
  id: string,
  organizationId: string,
) => {
  const entry = await db
    .update(products)
    .set({
      reuseCount: sql`${products.reuseCount} + 1`,
      lastReusedAt: new Date(),
    })
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
