import { db } from "@/db";
import { agentRunItems, type InsertAgentRunItem } from "@/db/schema";

/** Items are append-only and arrive per step — batch insert. */
export const insertAgentRunItems = async (values: InsertAgentRunItem[]) => {
  if (values.length === 0) return [];
  return db.insert(agentRunItems).values(values).returning();
};
