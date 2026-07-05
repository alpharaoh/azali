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

export const shipmentStage = pgEnum("shipment_stage", ShipmentStage);
export const shipmentStatus = pgEnum("shipment_status", ShipmentStatus);

export const shipments = pgTable(
  "shipments",
  {
    ...getDefaultColumns(),
    ...getDefaultOwnershipColumns(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),
    entryNumber: text("entry_number"),
    stage: shipmentStage("stage").notNull().default(ShipmentStage.Intake),
    status: shipmentStatus("status")
      .notNull()
      .default(ShipmentStatus.Autopilot),
    // Denormalized from the open review_requested event so the review queue
    // can sort/filter without digging into event payloads.
    reviewDeadlineAt: timestamp("review_deadline_at", { withTimezone: true }),
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
