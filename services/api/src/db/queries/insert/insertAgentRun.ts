import { db } from "@/db";
import { agentRuns, type InsertAgentRun } from "@/db/schema";

export const insertAgentRun = async (values: InsertAgentRun) => {
  const entry = await db.insert(agentRuns).values(values).returning();
  return entry[0];
};
