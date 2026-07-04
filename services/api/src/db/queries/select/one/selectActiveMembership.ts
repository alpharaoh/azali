import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { member, organization } from "@/db/schema";

export const selectActiveMembership = async (
  userId: string,
  activeOrganizationId?: string | null,
) => {
  const entry = await db
    .select()
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(
      activeOrganizationId
        ? and(
            eq(member.userId, userId),
            eq(member.organizationId, activeOrganizationId),
          )
        : eq(member.userId, userId),
    )
    .limit(1);

  const row = entry[0];
  if (!row) return null;

  return { ...row.member, organization: row.organization };
};
