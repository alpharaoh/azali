import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";

/**
 * Slugs are stable identifiers — cache per process. Used to attribute AI
 * spend to a readable tenant dimension in observability (Langfuse metadata).
 */
const cache = new Map<string, string>();

export async function getOrganizationSlug(
  organizationId: string,
): Promise<string> {
  const cached = cache.get(organizationId);
  if (cached) return cached;

  const entry = await db
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  const slug = entry[0]?.slug ?? organizationId;
  cache.set(organizationId, slug);
  return slug;
}
