import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { emailAccounts } from "@/db/schemas/emailAccounts";
import { shipments } from "@/db/schemas/shipments";
import { getDefaultColumns } from "@/db/utils/getDefaultColumns";
import { getDefaultOwnershipColumns } from "@/db/utils/getDefaultOwnershipColumns";
import { jsonbObject } from "@/db/utils/jsonbObject";

export enum InboundEmailStatus {
  /** Stored, pipeline still running. */
  Received = "received",
  /** Documents handed to shipment ingestion. */
  Processed = "processed",
  /** No shipment documents attached — nothing to do. */
  Ignored = "ignored",
  Failed = "failed",
}

export const inboundEmailStatus = pgEnum(
  "inbound_email_status",
  InboundEmailStatus,
);

/**
 * One email received on a connected inbox. The unique (account, unipile
 * email id) pair deduplicates webhook redeliveries; messageId and
 * invoiceNumber power attribution of follow-up emails to open shipments.
 */
export const inboundEmails = pgTable(
  "inbound_emails",
  {
    ...getDefaultColumns(),
    ...getDefaultOwnershipColumns(),
    emailAccountId: text("email_account_id")
      .notNull()
      .references(() => emailAccounts.id, { onDelete: "cascade" }),
    unipileEmailId: text("unipile_email_id").notNull(),
    // RFC message id — what later replies point at via In-Reply-To.
    messageId: text("message_id"),
    inReplyToMessageId: text("in_reply_to_message_id"),
    fromAddress: text("from_address").notNull(),
    subject: text("subject"),
    // Message content, capped at ingestion so one giant newsletter can't
    // bloat the table. Plain text is what extraction reads; the HTML is
    // kept for faithful display/audit.
    bodyPlain: text("body_plain"),
    bodyHtml: text("body_html"),
    // LLM-extracted commercial invoice number, normalized (uppercased,
    // whitespace/punctuation stripped); null when the model found none.
    invoiceNumber: text("invoice_number"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    shipmentId: text("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    status: inboundEmailStatus("status")
      .notNull()
      .default(InboundEmailStatus.Received),
    attachmentCount: integer("attachment_count").notNull().default(0),
    // Trimmed webhook metadata (recipients, folders, ids) for debugging.
    payload: jsonbObject("payload").notNull().default(sql`'{}'::jsonb`),
  },
  (table) => [
    uniqueIndex("inbound_emails_account_email_uidx").on(
      table.emailAccountId,
      table.unipileEmailId,
    ),
    index("inbound_emails_org_message_idx").on(
      table.organizationId,
      table.messageId,
    ),
    index("inbound_emails_org_invoice_idx").on(
      table.organizationId,
      table.invoiceNumber,
    ),
    index("inbound_emails_shipment_idx").on(table.shipmentId),
  ],
);

export type SelectInboundEmail = typeof inboundEmails.$inferSelect;
export type InsertInboundEmail = typeof inboundEmails.$inferInsert;
