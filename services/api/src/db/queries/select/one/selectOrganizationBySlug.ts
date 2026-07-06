import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";

export const selectOrganizationBySlug = async (slug: string) => {
  const entry = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);

  return entry[0];
};
