import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const embeddedClientSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
  })
  .nullable()
  .describe("The owning client, embedded for display.");

const dutyRateSchema = z
  .object({
    general: z.string().optional(),
    special: z.string().nullable().optional(),
    effective: z.string().optional(),
    effectivePct: z.number().nullable().optional(),
  })
  .nullable()
  .describe("Last computed duty picture — a cache, not the filed record.");

const productSchema = z.object({
  id: z.string().describe("Product id."),
  clientId: z.string().describe("The client this product belongs to."),
  client: embeddedClientSchema,
  name: z.string().describe("Product name as it appears on documents."),
  sku: z.string().nullable().describe("Part/model/SKU number, when known."),
  description: z.string().nullable(),
  htsCode: z
    .string()
    .nullable()
    .describe("Current HTS classification; null until first classified."),
  htsDescription: z.string().nullable().describe("The tariff line's text."),
  confidence: z.number().nullable().describe("Classification confidence."),
  dutyRate: dutyRateSchema,
  source: z
    .string()
    .nullable()
    .describe("Who set the classification: agent (AI) or broker."),
  reuseCount: z
    .number()
    .int()
    .describe(
      "Times this classification was reused for a shipment line without a fresh agent run.",
    ),
  lastReusedAt: z.string().nullable().describe("When it was last reused."),
  classifiedAt: z.string().nullable().describe("When it was classified."),
  classificationRunId: z
    .string()
    .nullable()
    .describe("The audit record behind the classification."),
  createdAt: z.string().describe("When the product was first seen."),
});

export class ListProductsResponseDto extends createZodDto(
  z.object({
    data: z.array(productSchema).describe("A page of the product library."),
    count: z
      .number()
      .int()
      .describe("Total rows matching the current filters."),
  }),
) {}

export class ProductResponseDto extends createZodDto(productSchema) {}

export class ProductStatsResponseDto extends createZodDto(
  z.object({
    entries: z.number().int().describe("Classified products on file."),
    totalReuses: z
      .number()
      .int()
      .describe("Shipment lines classified straight from product memory."),
    brokerApproved: z
      .number()
      .int()
      .describe("Entries whose classification a broker set or confirmed."),
    chaptersCovered: z
      .number()
      .int()
      .describe("Distinct HTS chapters across the knowledge base."),
    topChapters: z
      .array(
        z.object({
          chapter: z.string().describe("Two-digit HTS chapter."),
          count: z.number().int().describe("Classified products in it."),
        }),
      )
      .describe("The most-used HTS chapters, largest first."),
    growth: z
      .array(
        z.object({
          month: z.string().describe("Calendar month, YYYY-MM."),
          added: z
            .number()
            .int()
            .describe("Products classified during that month."),
        }),
      )
      .describe("Knowledge base growth by month, oldest first."),
  }),
) {}
