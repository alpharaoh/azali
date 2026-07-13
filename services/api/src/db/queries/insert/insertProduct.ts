import { db } from "@/db";
import { type InsertProduct, products } from "@/db/schema";

export const insertProduct = async (values: InsertProduct) => {
  const entry = await db.insert(products).values(values).returning();
  return entry[0];
};
