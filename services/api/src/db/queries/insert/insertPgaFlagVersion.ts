import { db } from "@/db";
import { type InsertPgaFlagVersion, pgaFlagVersions } from "@/db/schema";

export const insertPgaFlagVersion = async (values: InsertPgaFlagVersion) => {
  const entry = await db.insert(pgaFlagVersions).values(values).returning();
  return entry[0];
};
