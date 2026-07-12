import { isNull, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { agentRuns, type InsertAgentRun } from "@/db/schema";

export const listAgentRuns = async (
  where?: Partial<InsertAgentRun>,
  orderBy?: Partial<Record<keyof InsertAgentRun, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const extraConditions: SQL[] = [isNull(agentRuns.deletedAt)];

  return buildListQuery(agentRuns, {
    where,
    orderBy: orderBy ?? { createdAt: "desc" },
    limit,
    offset,
    extraConditions,
  });
};
