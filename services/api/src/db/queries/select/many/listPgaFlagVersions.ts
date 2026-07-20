import { isNull, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { type InsertPgaFlagVersion, pgaFlagVersions } from "@/db/schema";

export const listPgaFlagVersions = async (
  where?: Partial<InsertPgaFlagVersion> & { ids?: string[] },
  orderBy?: Partial<Record<keyof InsertPgaFlagVersion, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const extraConditions: SQL[] = [isNull(pgaFlagVersions.deletedAt)];

  return buildListQuery(pgaFlagVersions, {
    where,
    orderBy: orderBy ?? { publishedAt: "desc" },
    limit,
    offset,
    extraConditions,
  });
};
