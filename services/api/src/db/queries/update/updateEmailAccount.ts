import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailAccounts, type InsertEmailAccount } from "@/db/schema";

export const updateEmailAccount = async (
  id: string,
  values: Partial<InsertEmailAccount>,
) => {
  const entry = await db
    .update(emailAccounts)
    .set(values)
    .where(and(eq(emailAccounts.id, id), isNull(emailAccounts.deletedAt)))
    .returning();

  return entry[0];
};
