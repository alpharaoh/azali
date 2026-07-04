// import { and, eq, isNull } from "drizzle-orm";
// import { db } from "@/db";
// import { type InsertProject, project } from "@/db/schema";
//
// export const updateProject = async (
//   id: string,
//   organizationId: string,
//   values: Partial<InsertProject>,
// ) => {
//   const entry = await db
//     .update(project)
//     .set(values)
//     .where(
//       and(
//         eq(project.id, id),
//         eq(project.organizationId, organizationId),
//         isNull(project.deletedAt),
//       ),
//     )
//     .returning();
//
//   return entry[0];
// };
