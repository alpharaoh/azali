import { db } from "@/db";
import { type InsertInboundEmail, inboundEmails } from "@/db/schema";

/**
 * Insert an inbound email, deduplicating on (emailAccountId, unipileEmailId).
 * Returns undefined when the email was already recorded — the caller treats
 * that as a redelivered webhook and stops.
 */
export const insertInboundEmail = async (values: InsertInboundEmail) => {
  const entry = await db
    .insert(inboundEmails)
    .values(values)
    .onConflictDoNothing({
      target: [inboundEmails.emailAccountId, inboundEmails.unipileEmailId],
    })
    .returning();
  return entry[0];
};
