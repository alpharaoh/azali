import { db } from "@/db";
import { type InsertPgaFlag, pgaFlags } from "@/db/schema";

/** Flags arrive as a bulk batch per ingested publication. */
export const insertPgaFlags = async (values: InsertPgaFlag[]) => {
  if (values.length === 0) return [];
  return db.insert(pgaFlags).values(values).returning();
};
