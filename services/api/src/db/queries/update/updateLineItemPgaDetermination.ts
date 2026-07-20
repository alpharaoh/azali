import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  type InsertLineItemPgaDetermination,
  lineItemPgaDeterminations,
} from "@/db/schema";

export const updateLineItemPgaDetermination = async (
  id: string,
  organizationId: string,
  values: Partial<InsertLineItemPgaDetermination>,
) => {
  const entry = await db
    .update(lineItemPgaDeterminations)
    .set(values)
    .where(
      and(
        eq(lineItemPgaDeterminations.id, id),
        eq(lineItemPgaDeterminations.organizationId, organizationId),
        isNull(lineItemPgaDeterminations.deletedAt),
      ),
    )
    .returning();

  return entry[0];
};
