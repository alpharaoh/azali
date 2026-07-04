import { db } from "@/db";
import { project, InsertProject } from "@/db/schema";

export const insertProject = async (values: InsertProject) => {
  const entry = await db.insert(project).values(values).returning();
  return entry[0];
};
