import { db } from "@/db";
import {
  type InsertLineItemPgaDetermination,
  lineItemPgaDeterminations,
} from "@/db/schema";

/** Determinations arrive as a batch per screened line. */
export const insertLineItemPgaDeterminations = async (
  values: InsertLineItemPgaDetermination[],
) => {
  if (values.length === 0) return [];
  return db.insert(lineItemPgaDeterminations).values(values).returning();
};
