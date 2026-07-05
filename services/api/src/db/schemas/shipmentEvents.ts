import { sql } from "drizzle-orm";
import {
  customType,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { shipments } from "@/db/schemas/shipments";
import { getDefaultColumns } from "@/db/utils/getDefaultColumns";
import { getDefaultOwnershipColumns } from "@/db/utils/getDefaultOwnershipColumns";

// Drizzle's built-in jsonb double-serializes with the bun-sql driver (drizzle
// stringifies, then Bun.SQL encodes that string again → stored as a jsonb
// *string*). Pass the raw object through and let Bun.SQL serialize it once.
const jsonbObject = customType<{ data: Record<string, unknown> }>({
  dataType() {
    return "jsonb";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return (
      typeof value === "string" ? JSON.parse(value) : value
    ) as Record<string, unknown>;
  },
});

/**
 * Append-only timeline of everything that happens to a shipment — the audit
 * trail. `type` is an open string (e.g. invoice_received, email_received,
 * document_extracted, hts_lookup, vector_search, duty_calculated, entry_filed,
 * cbp_response_received, review_requested, review_resolved, stage_advanced)
 * so new event kinds cost no migration. Events are never updated or deleted.
 */
export const shipmentEvents = pgTable(
  "shipment_events",
  {
    ...getDefaultColumns(),
    ...getDefaultOwnershipColumns(),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    /** Who did it: ai | user | system | cbp (validated at the DTO layer). */
    actor: text("actor").notNull().default("system"),
    title: text("title").notNull(),
    /** When it happened — distinct from createdAt (when it was recorded). */
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    payload: jsonbObject("payload").notNull().default(sql`'{}'::jsonb`),
  },
  (table) => [
    index("shipment_events_shipment_occurred_idx").on(
      table.shipmentId,
      table.occurredAt,
    ),
    index("shipment_events_org_occurred_idx").on(
      table.organizationId,
      table.occurredAt,
    ),
    index("shipment_events_org_type_idx").on(table.organizationId, table.type),
  ],
);

export type SelectShipmentEvent = typeof shipmentEvents.$inferSelect;
export type InsertShipmentEvent = typeof shipmentEvents.$inferInsert;
