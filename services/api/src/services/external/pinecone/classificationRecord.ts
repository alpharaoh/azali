import type { SelectProduct } from "@/db/schema";
import { KnowledgeBaseService, type KnowledgeDocument } from "./service";

/** Record types stored in the knowledge-base index, filterable on search. */
export const KNOWLEDGE_RECORD_TYPES = {
  /** Raw extracted document text, written at ingestion. */
  document: "shipment_document",
  /** A product's current verified classification — the reusable verdict. */
  classification: "product_classification",
} as const;

/**
 * A product's classification as a knowledge-base record. The id is the
 * product id, so re-classifying or correcting a product REPLACES its record —
 * the store always holds exactly one, current verdict per product.
 *
 * The text is built for the query an agent actually asks ("wireless earbuds
 * silicone tips"): short, single-product, attribute-rich, ending in the
 * verdict.
 */
export function classificationRecord(
  product: SelectProduct,
): KnowledgeDocument | null {
  if (!product.htsCode) return null;

  const attributes = Object.entries(product.attributes ?? {})
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${String(value)}`);

  return {
    id: product.id,
    text: [
      `Product: ${product.name}`,
      product.sku ? `SKU: ${product.sku}` : null,
      product.description ? `Description: ${product.description}` : null,
      ...attributes,
      `Classified as HTS ${product.htsCode}${
        product.htsDescription ? ` — ${product.htsDescription}` : ""
      }`,
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: {
      type: KNOWLEDGE_RECORD_TYPES.classification,
      clientId: product.clientId,
      productId: product.id,
      htsCode: product.htsCode,
      source: product.source ?? "agent",
      ...(product.confidence !== null
        ? { confidence: product.confidence }
        : {}),
      verifiedAt: (product.classifiedAt ?? new Date()).toISOString(),
    },
  };
}

/**
 * Upsert a product's verified-classification record. Fire-and-forget
 * semantics: knowledge-base indexing must never fail a classification run or
 * a review resolution, so errors are logged and swallowed.
 */
export async function indexProductClassification(
  product: SelectProduct | undefined,
): Promise<void> {
  if (!product) return;
  const record = classificationRecord(product);
  if (!record) return;

  try {
    await KnowledgeBaseService.upsert({
      organizationId: product.organizationId,
      documents: [record],
    });
  } catch (error) {
    console.error(
      `Failed to index classification record for product ${product.id}`,
      error,
    );
  }
}
