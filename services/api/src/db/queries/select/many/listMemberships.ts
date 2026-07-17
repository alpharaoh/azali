import { buildListQuery } from "@/db/lib/buildListQuery";
import { member } from "@/db/schema";

type InsertMember = typeof member.$inferInsert;

export const listMemberships = async (
  where?: Partial<InsertMember> & { ids?: string[] },
  orderBy?: Partial<Record<keyof InsertMember, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  return buildListQuery(member, {
    where,
    orderBy: orderBy ?? { createdAt: "asc" },
    limit,
    offset,
  });
};
