import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { agentRuns } from "@/db/schemas/agentRuns";
import { products } from "@/db/schemas/products";
import { shipments } from "@/db/schemas/shipments";
import { getDefaultColumns } from "@/db/utils/getDefaultColumns";
import { getDefaultOwnershipColumns } from "@/db/utils/getDefaultOwnershipColumns";
import { jsonbArray, jsonbObject } from "@/db/utils/jsonbObject";

export enum LineItemStatus {
  Pending = "pending",
  Classified = "classified",
  NeedsReview = "needs_review",
  Approved = "approved",
  Corrected = "corrected",
}

export const lineItemStatus = pgEnum("line_item_status", LineItemStatus);

/**
 * A shipment's entry lines — one per invoice line item. The classification
 * fields are a SNAPSHOT frozen at classification time (entry integrity):
 * they stay as-filed even if the product is later reclassified.
 */
export const shipmentLineItems = pgTable(
  "shipment_line_items",
  {
    ...getDefaultColumns(),
    ...getDefaultOwnershipColumns(),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    lineNumber: integer("line_number").notNull(),
    // Invoice facts.
    description: text("description").notNull(),
    sku: text("sku"),
    quantity: doublePrecision("quantity"),
    unit: text("unit"),
    unitValueCents: bigint("unit_value_cents", { mode: "number" }),
    totalValueCents: bigint("total_value_cents", { mode: "number" }),
    originCountry: text("origin_country"),
    /** The supplier-declared HS/HTS code — a hypothesis, never ground truth. */
    declaredHts: text("declared_hts"),
    // Classification snapshot.
    htsCode: text("hts_code"),
    htsDescription: text("hts_description"),
    confidence: doublePrecision("confidence"),
    dutyRate: jsonbObject("duty_rate"),
    /** One-paragraph rationale for the chosen code. */
    summary: text("summary"),
    /** Runner-up codes ({value, detail, confidence, reason, amountUsd?,
     * deltaUsd?}), frozen at classification time like the fields above. */
    alternates: jsonbArray("alternates"),
    classificationRunId: text("classification_run_id").references(
      () => agentRuns.id,
      { onDelete: "set null" },
    ),
    /** True when the code came from product memory, not a fresh agent run. */
    reusedFromProduct: boolean("reused_from_product").notNull().default(false),
    status: lineItemStatus("status").notNull().default(LineItemStatus.Pending),
  },
  (table) => [
    uniqueIndex("shipment_line_items_shipment_line_uidx").on(
      table.shipmentId,
      table.lineNumber,
    ),
    index("shipment_line_items_org_shipment_idx").on(
      table.organizationId,
      table.shipmentId,
    ),
    index("shipment_line_items_product_idx").on(table.productId),
  ],
);

export type SelectShipmentLineItem = typeof shipmentLineItems.$inferSelect;
export type InsertShipmentLineItem = typeof shipmentLineItems.$inferInsert;
