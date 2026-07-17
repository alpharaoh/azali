import { buildListQuery } from "@/db/lib/buildListQuery";
import { type InsertInboundEmail, inboundEmails } from "@/db/schema";

export const listInboundEmails = async (
  where?: Partial<InsertInboundEmail> & { ids?: string[] },
  orderBy?: Partial<Record<keyof InsertInboundEmail, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  return buildListQuery(inboundEmails, {
    where,
    orderBy: orderBy ?? { receivedAt: "asc" },
    limit,
    offset,
  });
};
