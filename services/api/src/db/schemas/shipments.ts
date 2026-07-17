import { sql } from "drizzle-orm";
import {
  bigint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { clients } from "@/db/schemas/clients";
import { getDefaultColumns } from "@/db/utils/getDefaultColumns";
import { getDefaultOwnershipColumns } from "@/db/utils/getDefaultOwnershipColumns";
import { jsonbObject } from "@/db/utils/jsonbObject";

export enum ShipmentStage {
  Intake = "intake",
  Classification = "classification",
  Compliance = "compliance",
  Entry = "entry",
  Filed = "filed",
  Released = "released",
}

export enum ShipmentStatus {
  Autopilot = "autopilot",
  NeedsReview = "needs_review",
  AwaitingCbp = "awaiting_cbp",
  Released = "released",
}

export enum ShipmentSource {
  Manual = "manual",
  Email = "email",
}

export const shipmentStage = pgEnum("shipment_stage", ShipmentStage);
export const shipmentStatus = pgEnum("shipment_status", ShipmentStatus);
export const shipmentSource = pgEnum("shipment_source", ShipmentSource);

export const shipments = pgTable(
  "shipments",
  {
    ...getDefaultColumns(),
    ...getDefaultOwnershipColumns(),
    // Nullable: the row is pre-created at document upload, before the
    // client is known — synthesis resolves and fills it in.
    clientId: text("client_id").references(() => clients.id, {
      onDelete: "cascade",
    }),
    reference: text("reference").notNull(),
    entryNumber: text("entry_number"),
    stage: shipmentStage("stage").notNull().default(ShipmentStage.Intake),
    status: shipmentStatus("status")
      .notNull()
      .default(ShipmentStatus.Autopilot),
    // Human-readable current pipeline step ("Extracting documents",
    // "Classifying line 2 of 3"); null when nothing is running.
    processingState: text("processing_state"),
    // Denormalized from the open review_requested event so the review queue
    // can sort/filter without digging into event payloads.
    reviewDeadlineAt: timestamp("review_deadline_at", { withTimezone: true }),
    reviewType: text("review_type"),
    // Fast-changing display snapshot (current HTS + confidence, duty rate,
    // description, flags, next action) — the history lives in shipment_events.
    summary: jsonbObject("summary").notNull().default(sql`'{}'::jsonb`),
    originCountry: text("origin_country").notNull(),
    originPort: text("origin_port"),
    portOfEntry: text("port_of_entry").notNull(),
    transportMode: text("transport_mode").notNull(),
    conveyance: text("conveyance"),
    etaAt: timestamp("eta_at", { withTimezone: true }),
    valueCents: bigint("value_cents", { mode: "number" }).notNull(),
    dutyCents: bigint("duty_cents", { mode: "number" }).notNull().default(0),
    incoterm: text("incoterm"),
    entryType: text("entry_type"),
    source: shipmentSource("source").notNull().default(ShipmentSource.Manual),
    // Email-sourced shipments collect follow-up emails until this instant
    // (first email + intake window); "window open" = this is in the future.
    emailIntakeExpiresAt: timestamp("email_intake_expires_at", {
      withTimezone: true,
    }),
    // Normalized invoice number the intake window groups on; null when the
    // first email carried none (then only thread replies attribute).
    emailIntakeInvoiceNumber: text("email_intake_invoice_number"),
  },
  (table) => [
    uniqueIndex("shipments_org_reference_uidx").on(
      table.organizationId,
      table.reference,
    ),
  ],
);

export type SelectShipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;
