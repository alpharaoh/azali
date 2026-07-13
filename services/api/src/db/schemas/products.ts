import { isNotNull, sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
    /** { general, effective, effectivePct } for the classified line. */
    dutyRate: jsonbObject("duty_rate"),
    classificationRunId: text("classification_run_id").references(
      () => agentRuns.id,
      { onDelete: "set null" },
    ),
    classifiedAt: timestamp("classified_at", { withTimezone: true }),
    /** Who last set the classification: "agent" or "broker". */
    source: text("source"),
  },
  (table) => [
    index("products_org_client_idx").on(table.organizationId, table.clientId),
    uniqueIndex("products_org_client_sku_uidx")
      .on(table.organizationId, table.clientId, table.sku)
      .where(isNotNull(table.sku)),
  ],
);

export type SelectProduct = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
