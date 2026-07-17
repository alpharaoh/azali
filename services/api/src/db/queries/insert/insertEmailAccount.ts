import { db } from "@/db";
import { emailAccounts, type InsertEmailAccount } from "@/db/schema";

export const insertEmailAccount = async (values: InsertEmailAccount) => {
  const entry = await db.insert(emailAccounts).values(values).returning();
  return entry[0];
};
