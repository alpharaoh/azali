import { buildListQuery } from "@/db/lib/buildListQuery";
import { organization } from "@/db/schema";

type InsertOrganization = typeof organization.$inferInsert;

export const listOrganizations = async (
  where?: Partial<InsertOrganization> & { ids?: string[] },
  orderBy?: Partial<Record<keyof InsertOrganization, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  return buildListQuery(organization, {
    where,
    orderBy: orderBy ?? { createdAt: "asc" },
    limit,
    offset,
  });
};
