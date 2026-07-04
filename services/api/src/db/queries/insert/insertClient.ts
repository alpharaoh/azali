import { db } from "@/db";
import { clients, type InsertClient } from "@/db/schema";

export const insertClient = async (values: InsertClient) => {
  const entry = await db.insert(clients).values(values).returning();
  return entry[0];
};
