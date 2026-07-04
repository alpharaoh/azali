import { isNull, SQL } from "drizzle-orm";
import { project, InsertProject } from "@/db/schema";
import { buildListQuery } from "@/db/lib/buildListQuery";

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
