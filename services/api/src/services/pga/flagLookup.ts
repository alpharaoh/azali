import { listPgaFlags } from "@/db/queries/select/many/listPgaFlags";
import { listPgaFlagVersions } from "@/db/queries/select/many/listPgaFlagVersions";
import type { PgaFlagRequirement } from "@/db/schema";

export interface PgaFlagMatch {
  agencyCode: string;
  flagCode: string;
  requirement: PgaFlagRequirement;
  programDescription: string | null;
  /** The prefix row that matched (a match at 4 digits covers the whole
   * heading; a match at 10 is line-specific). */
  matchedPrefix: string;
}

export interface PgaFlagLookupResult {
  version: {
    id: string;
    pubNumber: string;
    publishedAt: Date;
    source: string;
  };
  flags: PgaFlagMatch[];
}

/** Digits only — the reference and our table store undotted prefixes. */
export const normalizeHtsCode = (htsCode: string) =>
  htsCode.replace(/\D/g, "");

/** Even-length prefixes (2–10 digits) the reference can list a code at. */
export const expandHtsPrefixes = (htsCode: string) => {
  const digits = normalizeHtsCode(htsCode);
  return [2, 4, 6, 8, 10]
    .filter((length) => digits.length >= length)
    .map((length) => digits.slice(0, length));
};

/**
 * Deterministic stage 1 of PGA screening: which agency flags does the active
 * ACE Agency Tariff Code Reference publication attach to this HTS code?
 * Pure lookup — the judgment about whether a flagged agency actually applies
 * to a given shipment belongs to the screening agent, never to this layer.
 */
export const lookupPgaFlags = async (
  htsCode: string,
): Promise<PgaFlagLookupResult> => {
  const { data: versions } = await listPgaFlagVersions(
    { active: true },
    { publishedAt: "desc" },
    1,
  );
  const version = versions[0];
  if (!version) {
    throw new Error(
      "No active PGA flag version — run scripts/seed-pga-flags.ts first",
    );
  }

  const { data: rows } = await listPgaFlags({
    versionId: version.id,
    htsPrefixesOf: htsCode,
  });

  // One agency+flag can match at several prefix lengths (e.g. a chapter-wide
  // AQ1 and a line-specific AQ2); keep the most specific match per pair.
  const byAgencyFlag = new Map<string, PgaFlagMatch>();
  for (const row of rows) {
    const key = `${row.agencyCode}:${row.flagCode}`;
    const existing = byAgencyFlag.get(key);
    if (!existing || row.htsPrefix.length > existing.matchedPrefix.length) {
      byAgencyFlag.set(key, {
        agencyCode: row.agencyCode,
        flagCode: row.flagCode,
        requirement: row.requirement,
        programDescription: row.programDescription,
        matchedPrefix: row.htsPrefix,
      });
    }
  }

  return {
    version: {
      id: version.id,
      pubNumber: version.pubNumber,
      publishedAt: version.publishedAt,
      source: version.source,
    },
    flags: [...byAgencyFlag.values()].sort(
      (a, b) =>
        a.agencyCode.localeCompare(b.agencyCode) ||
        a.flagCode.localeCompare(b.flagCode),
    ),
  };
};
