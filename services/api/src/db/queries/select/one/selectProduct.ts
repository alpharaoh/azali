import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";

export const selectProduct = async (id: string, organizationId: string) => {
  const entry = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, id),
        eq(products.organizationId, organizationId),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);

  return entry[0];
};
