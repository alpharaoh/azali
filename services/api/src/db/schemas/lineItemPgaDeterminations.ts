import { doublePrecision, index, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { agentRuns } from "@/db/schemas/agentRuns";
import { pgaFlagVersions } from "@/db/schemas/pgaFlags";
import { shipmentLineItems } from "@/db/schemas/shipmentLineItems";
import { shipments } from "@/db/schemas/shipments";
import { getDefaultColumns } from "@/db/utils/getDefaultColumns";
import { getDefaultOwnershipColumns } from "@/db/utils/getDefaultOwnershipColumns";
import { jsonbArray } from "@/db/utils/jsonbObject";

export enum PgaDeterminationKind {
  /** Agency data must be filed with the entry (message set). */
  Required = "required",
  /** Formally disclaimed with a coded declaration (A–D). */
  Disclaim = "disclaim",
  NotApplicable = "not_applicable",
}

export enum PgaFlagSource {
  /** Surfaced by the deterministic ACE flag-table lookup. */
  FlagTable = "flag_table",
  /** Surfaced by the agent's jurisdiction sweep despite no flag — flag
   * tables lag HTS revisions, so unflagged codes can still be regulated. */
  JurisdictionalAnalysis = "jurisdictional_analysis",
}

export enum PgaDeterminationStatus {
  Proposed = "proposed",
  Approved = "approved",
  Corrected = "corrected",
}

export const pgaDeterminationKind = pgEnum(
  "pga_determination_kind",
  PgaDeterminationKind,
);
export const pgaFlagSource = pgEnum("pga_flag_source", PgaFlagSource);
export const pgaDeterminationStatus = pgEnum(
  "pga_determination_status",
  PgaDeterminationStatus,
);

/**
 * One agency determination per line item per screening: whether the agency's
 * data must be filed, is formally disclaimed, or does not apply. Rows are
 * per-shipment by construction (via the line item) — PGA applicability turns
 * on origin and intended use, which vary shipment to shipment even for the
 * same product.
 */
export const lineItemPgaDeterminations = pgTable(
  "line_item_pga_determinations",
  {
    ...getDefaultColumns(),
    ...getDefaultOwnershipColumns(),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    lineItemId: text("line_item_id")
      .notNull()
      .references(() => shipmentLineItems.id, { onDelete: "cascade" }),
    agencyCode: text("agency_code").notNull(),
    agencyName: text("agency_name"),
    programCode: text("program_code"),
    flagCode: text("flag_code"),
    flagSource: pgaFlagSource("flag_source").notNull(),
    /** The flag's variant ("may_be_required" | "required"); null when the
     * agency was surfaced by jurisdictional analysis, not a flag. */
    requirement: text("requirement"),
    determination: pgaDeterminationKind("determination").notNull(),
    /** Mandatory when determination = disclaim; agency-specific semantics. */
    disclaimCode: text("disclaim_code"),
    rationale: text("rationale").notNull(),
    /** [{name, description, present, sourceDocument}] */
    dataElements: jsonbArray("data_elements"),
    /** [{kind, ref, quote, href}] */
    citations: jsonbArray("citations"),
    confidence: doublePrecision("confidence").notNull(),
    screeningRunId: text("screening_run_id").references(() => agentRuns.id, {
      onDelete: "set null",
    }),
    flagVersionId: text("flag_version_id").references(
      () => pgaFlagVersions.id,
      { onDelete: "set null" },
    ),
    status: pgaDeterminationStatus("status")
      .notNull()
      .default(PgaDeterminationStatus.Proposed),
  },
  (table) => [
    index("line_item_pga_determinations_org_shipment_idx").on(
      table.organizationId,
      table.shipmentId,
    ),
    index("line_item_pga_determinations_line_idx").on(table.lineItemId),
  ],
);

export type SelectLineItemPgaDetermination =
  typeof lineItemPgaDeterminations.$inferSelect;
export type InsertLineItemPgaDetermination =
  typeof lineItemPgaDeterminations.$inferInsert;
