import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";

export const updateOrganization = async (
  id: string,
  values: Partial<typeof organization.$inferInsert>,
) => {
  const entry = await db
    .update(organization)
    .set(values)
    .where(eq(organization.id, id))
    .returning();

  return entry[0];
};
