import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { shipments } from "@/db/schemas/shipments";
import { getDefaultColumns } from "@/db/utils/getDefaultColumns";
import { getDefaultOwnershipColumns } from "@/db/utils/getDefaultOwnershipColumns";
import { jsonbObject } from "@/db/utils/jsonbObject";

export enum ShipmentDocumentCategory {
  CommercialInvoice = "commercial_invoice",
  PackingList = "packing_list",
  BillOfLading = "bill_of_lading",
  ArrivalNotice = "arrival_notice",
  Other = "other",
}

export enum ShipmentDocumentStatus {
  Pending = "pending",
  Extracted = "extracted",
  Failed = "failed",
}

export const shipmentDocumentCategory = pgEnum(
  "shipment_document_category",
  ShipmentDocumentCategory,
);
export const shipmentDocumentStatus = pgEnum(
  "shipment_document_status",
  ShipmentDocumentStatus,
);

export const shipmentDocuments = pgTable(
  "shipment_documents",
  {
    ...getDefaultColumns(),
    ...getDefaultOwnershipColumns(),
    // Nullable: rows are created when ingestion starts, before the shipment
    // they belong to exists; the batch step links them once it's created.
    shipmentId: text("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    category: shipmentDocumentCategory("category")
      .notNull()
      .default(ShipmentDocumentCategory.Other),
    // Object key of the original file — the handle for viewing and deletion.
    storageKey: text("storage_key").notNull(),
    // Object key of the page-1 preview image, once rendered.
    previewKey: text("preview_key"),
    pageCount: integer("page_count"),
    status: shipmentDocumentStatus("status")
      .notNull()
      .default(ShipmentDocumentStatus.Pending),
    // { summary: string, fields: [{ label, value }] } — mirrors the UI's
    // document line shape so extractions render without mapping.
    extraction: jsonbObject("extraction").notNull().default(sql`'{}'::jsonb`),
    failureReason: text("failure_reason"),
  },
  (table) => [
    index("shipment_documents_shipment_idx").on(table.shipmentId),
    index("shipment_documents_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    // One row per stored object — re-delivered ingestion events become no-ops.
    uniqueIndex("shipment_documents_storage_key_uidx").on(table.storageKey),
  ],
);

export type SelectShipmentDocument = typeof shipmentDocuments.$inferSelect;
export type InsertShipmentDocument = typeof shipmentDocuments.$inferInsert;

export interface DocumentExtraction {
  summary: string;
  fields: Array<{ label: string; value: string }>;
}
