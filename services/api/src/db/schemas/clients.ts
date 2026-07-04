import { pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { getDefaultColumns } from "@/db/utils/getDefaultColumns";
import { getDefaultOwnershipColumns } from "@/db/utils/getDefaultOwnershipColumns";

export enum ClientAutonomy {
  Supervised = "supervised",
  Autopilot = "autopilot",
}

export enum ClientStatus {
  Active = "active",
  Paused = "paused",
}

export const clientAutonomy = pgEnum("client_autonomy", ClientAutonomy);
export const clientStatus = pgEnum("client_status", ClientStatus);

export const clients = pgTable("clients", {
  ...getDefaultColumns(),
  ...getDefaultOwnershipColumns(),
  name: text("name").notNull(),
  image: text("image"),
  iorNumber: text("ior_number").notNull(),
  bondNumber: text("bond_number").notNull(),
  primaryOrigin: text("primary_origin").notNull(),
  industry: text("industry").notNull(),
  autonomy: clientAutonomy("autonomy")
    .notNull()
    .default(ClientAutonomy.Supervised),
  status: clientStatus("status").notNull().default(ClientStatus.Active),
  portsOfEntry: text("ports_of_entry").array().notNull().default([]),
});

export type SelectClient = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
