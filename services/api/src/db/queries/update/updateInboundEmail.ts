import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { type InsertInboundEmail, inboundEmails } from "@/db/schema";

export const updateInboundEmail = async (
  id: string,
  organizationId: string,
  values: Partial<InsertInboundEmail>,
) => {
  const entry = await db
    .update(inboundEmails)
    .set(values)
    .where(
      and(
        eq(inboundEmails.id, id),
        eq(inboundEmails.organizationId, organizationId),
      ),
    )
    .returning();

  return entry[0];
};
