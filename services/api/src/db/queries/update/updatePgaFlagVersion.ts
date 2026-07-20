import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { type InsertPgaFlagVersion, pgaFlagVersions } from "@/db/schema";

export const updatePgaFlagVersion = async (
  id: string,
  values: Partial<InsertPgaFlagVersion>,
) => {
  const entry = await db
    .update(pgaFlagVersions)
    .set(values)
    .where(and(eq(pgaFlagVersions.id, id), isNull(pgaFlagVersions.deletedAt)))
    .returning();

  return entry[0];
};
