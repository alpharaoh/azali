import { inArray, isNull, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { type InsertPgaFlag, pgaFlags } from "@/db/schema";

export interface ListPgaFlagsFilters {
  ids?: string[];
  /** Match rows whose htsPrefix is any even-length prefix (2–10 digits) of
   * this HTS code (dots allowed — normalized to digits here). */
  htsPrefixesOf?: string;
}

export const listPgaFlags = async (
  where?: Partial<InsertPgaFlag> & ListPgaFlagsFilters,
  orderBy?: Partial<Record<keyof InsertPgaFlag, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const { htsPrefixesOf, ...rest } = where ?? {};
  const extraConditions: SQL[] = [isNull(pgaFlags.deletedAt)];

  if (htsPrefixesOf !== undefined) {
    const digits = htsPrefixesOf.replace(/\D/g, "");
    const prefixes = [2, 4, 6, 8, 10]
      .filter((length) => digits.length >= length)
      .map((length) => digits.slice(0, length));
    extraConditions.push(
      inArray(pgaFlags.htsPrefix, prefixes.length ? prefixes : [""]),
    );
  }

  return buildListQuery(pgaFlags, {
    where: rest,
    orderBy: orderBy ?? { htsPrefix: "asc" },
    limit,
    offset,
    extraConditions,
  });
};
