import { isNull, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { emailAccounts, type InsertEmailAccount } from "@/db/schema";

export const listEmailAccounts = async (
  where?: Partial<InsertEmailAccount> & { ids?: string[] },
  orderBy?: Partial<Record<keyof InsertEmailAccount, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const extraConditions: SQL[] = [isNull(emailAccounts.deletedAt)];

  return buildListQuery(emailAccounts, {
    where,
    orderBy: orderBy ?? { createdAt: "desc" },
    limit,
    offset,
    extraConditions,
  });
};
