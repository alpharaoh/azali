import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, type InsertAgentRun } from "@/db/schema";

export const updateAgentRun = async (
  id: string,
  organizationId: string,
  values: Partial<InsertAgentRun>,
) => {
  const entry = await db
    .update(agentRuns)
    .set(values)
    .where(
      and(eq(agentRuns.id, id), eq(agentRuns.organizationId, organizationId)),
    )
    .returning();

  return entry[0];
};
