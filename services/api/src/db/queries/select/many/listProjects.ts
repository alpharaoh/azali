import { isNull, type SQL } from "drizzle-orm";
import { buildListQuery } from "@/db/lib/buildListQuery";
import { type InsertProject, project } from "@/db/schema";

export interface ListProjectsFilters {
  ids?: string[];
}

export const listProjects = async (
  where?: Partial<InsertProject> & ListProjectsFilters,
  orderBy?: Partial<Record<keyof InsertProject, "asc" | "desc">>,
  limit?: number,
  offset?: number,
) => {
  const extraConditions: SQL[] = [isNull(project.deletedAt)];

  return buildListQuery(project, {
    where,
    orderBy,
    limit,
    offset,
    extraConditions,
  });
};
