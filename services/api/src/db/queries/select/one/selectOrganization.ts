import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";

export const selectOrganization = async (id: string) => {
  const entry = await db
    .select()
    .from(organization)
    .where(eq(organization.id, id))
    .limit(1);

  return entry[0];
};
