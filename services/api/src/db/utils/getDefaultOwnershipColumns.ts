import { text } from "drizzle-orm/pg-core";
import { organization, user } from "@/db/schema";

export const getDefaultOwnershipColumns = () => {
  return {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  };
};
