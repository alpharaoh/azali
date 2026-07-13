import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const productSchema = z.object({
  id: z.string().describe("Product id."),
  clientId: z.string().describe("The client this product belongs to."),
  name: z.string().describe("Product name as it appears on documents."),
  sku: z.string().nullable().describe("Part/model/SKU number, when known."),
  description: z.string().nullable(),
  htsCode: z
    .string()
    .nullable()
    .describe("Current HTS classification; null until first classified."),
  htsDescription: z.string().nullable().describe("The tariff line's text."),
  confidence: z.number().nullable().describe("Classification confidence."),
  source: z
    .string()
    .nullable()
    .describe("Who set the classification: agent (AI) or broker."),
  classifiedAt: z.string().nullable().describe("When it was classified."),
  classificationRunId: z
    .string()
    .nullable()
    .describe("The audit record behind the classification."),
  createdAt: z.string().describe("When the product was first seen."),
});

export class ListProductsResponseDto extends createZodDto(
  z.object({
    products: z
      .array(productSchema)
      .describe("The product library, newest first."),
  }),
) {}

export class ProductResponseDto extends createZodDto(productSchema) {}
