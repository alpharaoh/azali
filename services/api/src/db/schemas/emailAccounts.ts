import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { getDefaultColumns } from "@/db/utils/getDefaultColumns";
import { getDefaultOwnershipColumns } from "@/db/utils/getDefaultOwnershipColumns";

export enum EmailAccountStatus {
  /** Hosted-auth link issued; waiting for the customer to finish. */
  Pending = "pending",
  Connected = "connected",
  Disconnected = "disconnected",
  Error = "error",
}

export const emailAccountStatus = pgEnum(
  "email_account_status",
  EmailAccountStatus,
);

/**
 * A customer inbox connected through Unipile. `userId` is the member who
 * connected it — they become the actor for everything the inbox produces.
 */
export const emailAccounts = pgTable(
  "email_accounts",
  {
    ...getDefaultColumns(),
    ...getDefaultOwnershipColumns(),
    // Null until the hosted-auth notify callback lands.
    unipileAccountId: text("unipile_account_id"),
    provider: text("provider"),
    emailAddress: text("email_address"),
    status: emailAccountStatus("status")
      .notNull()
      .default(EmailAccountStatus.Pending),
    // Single-use opaque token passed to Unipile as the hosted-auth `name`
    // and echoed back on the notify callback; nulled once consumed.
    connectToken: text("connect_token"),
    connectTokenExpiresAt: timestamp("connect_token_expires_at", {
      withTimezone: true,
    }),
    lastWebhookAt: timestamp("last_webhook_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("email_accounts_unipile_account_uidx").on(
      table.unipileAccountId,
    ),
    uniqueIndex("email_accounts_connect_token_uidx").on(table.connectToken),
    index("email_accounts_org_idx").on(table.organizationId),
  ],
);

export type SelectEmailAccount = typeof emailAccounts.$inferSelect;
export type InsertEmailAccount = typeof emailAccounts.$inferInsert;
