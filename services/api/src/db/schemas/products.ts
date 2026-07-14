import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { agentRuns } from "@/db/schemas/agentRuns";
import { clients } from "@/db/schemas/clients";
import { getDefaultColumns } from "@/db/utils/getDefaultColumns";
import { getDefaultOwnershipColumns } from "@/db/utils/getDefaultOwnershipColumns";
import { jsonbObject } from "@/db/utils/jsonbObject";

/**
 * The importer's product library — the SKU is the unit of classification.
 * A product carries its current classification (and the audit run that
 * produced it); shipment line items snapshot it per entry. Repeat shipments
 * of a classified product reuse it without another agent run.
 */
export const products = pgTable(
  "products",
  {
    ...getDefaultColumns(),
    ...getDefaultOwnershipColumns(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    description: text("description"),
    /** Classification-relevant facts accumulated from document extractions. */
    attributes: jsonbObject("attributes").notNull().default(sql`'{}'::jsonb`),
    // Current classification — null until first classified.
    htsCode: text("hts_code"),
    htsDescription: text("hts_description"),
    confidence: doublePrecision("confidence"),
    /**
     * Last computed duty picture — a CACHE, not truth. Duty is a property
     * of the entry line (code × origin × value × date); the per-line
     * snapshot on shipment_line_items is the filed record.
     */
    dutyRate: jsonbObject("duty_rate"),
    classificationRunId: text("classification_run_id").references(
      () => agentRuns.id,
      { onDelete: "set null" },
    ),
    classifiedAt: timestamp("classified_at", { withTimezone: true }),
    /** Who last set the classification: "agent" or "broker". */
    source: text("source"),
    /**
     * Times this classification was reused for a shipment line without an
     * agent run. Denormalized — shipment deletion cascades away line items,
     * but the hit history should survive.
     */
    reuseCount: integer("reuse_count").notNull().default(0),
    lastReusedAt: timestamp("last_reused_at", { withTimezone: true }),
  },
  (table) => [
    index("products_org_client_idx").on(table.organizationId, table.clientId),
    // NOT unique: real invoices print the parent SKU on accessory lines
    // ("replacement shade for LUX-SP210"), so identity is SKU + name.
    index("products_org_client_sku_idx").on(
      table.organizationId,
      table.clientId,
      table.sku,
    ),
  ],
);

export type SelectProduct = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
