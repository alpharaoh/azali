import { db } from "@/db";
import { eq, and, isNull } from "drizzle-orm";
import { project } from "@/db/schema";

export const selectProject = async (id: string, organizationId: string) => {
  const entry = await db
    .select()
    .from(project)
    .where(
      and(
        eq(project.id, id),
        eq(project.organizationId, organizationId),
        isNull(project.deletedAt),
      ),
    )
    .limit(1);

  return entry[0];
};
