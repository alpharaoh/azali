import { buildListQuery } from "@/db/lib/buildListQuery";
import { agentRunItems, type InsertAgentRunItem } from "@/db/schema";

export const listAgentRunItems = async (
  where?: Partial<InsertAgentRunItem> & { ids?: string[] },
  orderBy?: Partial<Record<keyof InsertAgentRunItem, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  return buildListQuery(agentRunItems, {
    where,
    // The run's audit record reads in execution order.
    orderBy: orderBy ?? { stepIndex: "asc", itemIndex: "asc" },
    limit,
    offset,
  });
};
