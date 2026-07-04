import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const project = pgTable(
  "project",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name"),
    status: text("status", { enum: ["draft", "active"] })
      .notNull()
      .default("draft"),
    sourceS3Key: text("source_s3_key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("project_organizationId_idx").on(table.organizationId),
    index("project_userId_idx").on(table.userId),
  ],
);

export type InsertProject = typeof project.$inferInsert;
export type SelectProject = typeof project.$inferSelect;
