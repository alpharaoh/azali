import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { getDefaultColumns } from "@/db/utils/getDefaultColumns";

/**
 * GLOBAL reference data — deliberately no ownership columns. The PGA flag
 * table is CBP-published and identical for every organization; screenings
 * cite the version they ran against, so rows are never mutated after import
 * (a new publication becomes a new version).
 */

export enum PgaFlagRequirement {
  /** The "1" flag variant (FD1, AQ1, DT1…): agency data MAY be required —
   * file the message set or formally disclaim. */
  MayBeRequired = "may_be_required",
  /** The "2" flag variant (FD2, AQ2, DT2…): agency data IS required. */
  Required = "required",
}

export const pgaFlagRequirement = pgEnum(
  "pga_flag_requirement",
  PgaFlagRequirement,
);

/** One row per ingested publication of the ACE Agency Tariff Code Reference. */
export const pgaFlagVersions = pgTable("pga_flag_versions", {
  ...getDefaultColumns(),
  source: text("source").notNull(),
  /** CBP publication number, e.g. "0875-0419". */
  pubNumber: text("pub_number").notNull(),
  /** The publication's own date — cited by every screening (reasonable care). */
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull(),
  recordCount: integer("record_count").notNull(),
  /** Exactly one active version; lookups pin to it. */
  active: boolean("active").notNull().default(false),
});

/**
 * HTS-prefix → agency flag rows from the active publication. One HTS code
 * matches many rows (multiple agencies/programs), at prefix lengths 2–10.
 */
export const pgaFlags = pgTable(
  "pga_flags",
  {
    ...getDefaultColumns(),
    versionId: text("version_id")
      .notNull()
      .references(() => pgaFlagVersions.id, { onDelete: "cascade" }),
    /** Digits only, no dots — normalized from the publication's dotted form. */
    htsPrefix: text("hts_prefix").notNull(),
    prefixLength: integer("prefix_length").notNull(),
    /** e.g. "FDA", "APH", "EPA", "NHT", "FWS". */
    agencyCode: text("agency_code").notNull(),
    /** e.g. "FD1", "AQ2", "DT1", "EP5". */
    flagCode: text("flag_code").notNull(),
    programDescription: text("program_description"),
    requirement: pgaFlagRequirement("requirement").notNull(),
  },
  (table) => [
    index("pga_flags_version_prefix_idx").on(table.versionId, table.htsPrefix),
    index("pga_flags_version_agency_idx").on(
      table.versionId,
      table.agencyCode,
    ),
  ],
);

export type SelectPgaFlagVersion = typeof pgaFlagVersions.$inferSelect;
export type InsertPgaFlagVersion = typeof pgaFlagVersions.$inferInsert;
export type SelectPgaFlag = typeof pgaFlags.$inferSelect;
export type InsertPgaFlag = typeof pgaFlags.$inferInsert;
