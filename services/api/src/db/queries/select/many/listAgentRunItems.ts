import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRunItems } from "@/db/schema";

/** The full ordered audit record of a run. */
export const listAgentRunItems = async (
  runId: string,
  organizationId: string,
) => {
  return db
    .select()
    .from(agentRunItems)
    .where(
      and(
        eq(agentRunItems.runId, runId),
        eq(agentRunItems.organizationId, organizationId),
      ),
    )
    .orderBy(asc(agentRunItems.stepIndex), asc(agentRunItems.itemIndex));
};
