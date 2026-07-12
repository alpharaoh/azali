import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";

export const selectAgentRun = async (id: string, organizationId: string) => {
  const entry = await db
    .select()
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.id, id),
        eq(agentRuns.organizationId, organizationId),
        isNull(agentRuns.deletedAt),
      ),
    )
    .limit(1);

  return entry[0];
};
