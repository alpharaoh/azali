import { sql } from "drizzle-orm";
import { text, timestamp } from "drizzle-orm/pg-core";

const createIdColumn = () =>
  text("id").primaryKey().unique().default(sql.raw(`uuidv7()::text`));

export const getDefaultColumns = () => {
  return {
    id: createIdColumn(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  };
};
