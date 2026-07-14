import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const csv = <S extends z.ZodType>(schema: S) =>
  z.preprocess(
    (value) =>
      typeof value === "string" ? value.split(",").filter(Boolean) : value,
    z.array(schema),
  );

export const sortableProductColumns = [
  "name",
  "sku",
  "htsCode",
  "confidence",
  "reuseCount",
  "lastReusedAt",
  "classifiedAt",
  "createdAt",
] as const;

export const ProductSource = ["agent", "broker"] as const;

export const listProductsSchema = z.object({
  search: z
    .string()
    .optional()
    .describe(
      "Free-text search on product name, SKU, HTS code, or client name.",
    ),
  clientId: csv(z.string())
    .optional()
    .describe("Filter to one or more clients; comma-separated."),
  source: csv(z.enum(ProductSource))
    .optional()
    .describe(
      "Filter by who set the classification (agent or broker); comma-separated.",
    ),
  sortBy: z
    .enum(sortableProductColumns)
    .default("reuseCount")
    .describe("Column to sort by."),
  sortDir: z.enum(["asc", "desc"]).default("desc").describe("Sort direction."),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe("Page size (1–100)."),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Rows to skip before the page starts."),
});

export class ListProductsDto extends createZodDto(listProductsSchema) {}
