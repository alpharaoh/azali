import type { SelectProduct } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import {
  KnowledgeBaseService,
  type KnowledgeDocument,
  type KnowledgeMatch,
} from "./service";

const log = createLogger("knowledge-base");

/** Record types stored in the knowledge-base index, filterable on search.
 * Every read tool and write path pins a type — classification precedent and
 * PGA screening precedent never mix in each other's search results. */
export const KNOWLEDGE_RECORD_TYPES = {
  /** Raw extracted document text, written at ingestion. */
  document: "shipment_document",
  /** A product's current verified classification — the reusable verdict. */
  classification: "product_classification",
  /** A line's PGA screening outcome for one product + origin. */
  pgaScreening: "pga_screening",
} as const;

/**
 * Minimum similarity for another product's record to count as the SAME
 * real-world product during dedupe. llama-text-embed-v2 cosine scores land
 * ~0.97+ for near-identical text and typically below 0.9 for same-category
 * but different products. Every candidate's score is logged on dedupe so
 * this can be tuned from real traffic.
 */
export const DEDUPE_SIMILARITY_THRESHOLD = 0.95;

/**
 * Stricter bar for linking an ingested line to an existing product on
 * semantic similarity alone — a false positive here silently classifies a
 * DIFFERENT product, which is worse than a duplicate row.
 */
export const SEMANTIC_MATCH_THRESHOLD = 0.97;

/**
 * Broker verification is ground truth — present it as full confidence
 * everywhere downstream without overwriting the agent's original
 * calibration data on the product row.
 */
export function effectiveConfidence(product: SelectProduct): number | null {
  return product.source === "broker" ? 1 : product.confidence;
}

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
  const confidence = effectiveConfidence(product);

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
      ...(confidence !== null ? { confidence } : {}),
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
    log.error(
      { err: error, productId: product.id },
      "failed to index classification record",
    );
  }
}

/**
 * Decide how a broker-verified product's record reconciles with the client's
 * existing classification records. Near-identical records with the SAME code
 * are duplicates of this verdict: an existing broker record makes our insert
 * redundant (broker records are never removed), while agent records are
 * superseded and removed. Near-identical records with a DIFFERENT code are
 * conflicts — kept and logged, never auto-deleted, because similarity is
 * fuzzy and they may be genuinely different products.
 */
export function planDedupe(
  matches: KnowledgeMatch[],
  product: SelectProduct,
): { insert: boolean; removeIds: string[]; conflicts: KnowledgeMatch[] } {
  let insert = true;
  const removeIds: string[] = [];
  const conflicts: KnowledgeMatch[] = [];

  for (const match of matches) {
    // The product's own (possibly stale) record — replaced by id on upsert.
    if (match.id === product.id) continue;
    if (match.score < DEDUPE_SIMILARITY_THRESHOLD) continue;

    if (match.metadata.htsCode !== product.htsCode) {
      conflicts.push(match);
    } else if (match.metadata.source === "broker") {
      insert = false;
    } else {
      removeIds.push(match.id);
    }
  }

  return { insert, removeIds, conflicts };
}

/**
 * Broker resolution publishes the single authoritative record for a product:
 * search FIRST for near-duplicates among the client's records, skip the
 * insert when an equivalent broker-verified record already exists, then
 * remove the agent records this verdict supersedes. The duplicate product
 * ROW keeps its agent classification — harmless for same-code duplicates,
 * since deterministic reuse yields the same broker-confirmed code.
 *
 * Fire-and-forget like indexProductClassification: dedupe must never fail a
 * review resolution, so errors are logged and swallowed.
 */
export async function indexAndDedupeClassification(
  product: SelectProduct | undefined,
): Promise<void> {
  if (!product) return;
  const record = classificationRecord(product);
  if (!record) return;

  try {
    const matches = await KnowledgeBaseService.search({
      organizationId: product.organizationId,
      query: record.text,
      topK: 10,
      filter: {
        type: { $eq: KNOWLEDGE_RECORD_TYPES.classification },
        clientId: { $eq: product.clientId },
      },
    });
    // Every candidate's score, logged — the tuning data for
    // DEDUPE_SIMILARITY_THRESHOLD.
    log.info(
      {
        productId: product.id,
        htsCode: product.htsCode,
        candidates: matches.map((match) => ({
          productId: match.metadata.productId,
          score: match.score,
          htsCode: match.metadata.htsCode,
          source: match.metadata.source,
        })),
      },
      "dedupe candidates for broker-verified classification",
    );

    const { insert, removeIds, conflicts } = planDedupe(matches, product);
    for (const conflict of conflicts) {
      log.warn(
        {
          productId: product.id,
          htsCode: product.htsCode,
          conflictProductId: conflict.metadata.productId,
          conflictHtsCode: conflict.metadata.htsCode,
          score: conflict.score,
        },
        "near-identical record with a different HTS code — kept, not deduped",
      );
    }

    if (insert) {
      await KnowledgeBaseService.upsert({
        organizationId: product.organizationId,
        documents: [record],
      });
    }
    // A skipped insert still evicts this product's own stale pre-approval
    // record (autopilot may have indexed it); deleting a missing id is a
    // no-op.
    const ids = insert ? removeIds : [...removeIds, product.id];
    if (ids.length > 0) {
      await KnowledgeBaseService.remove({
        organizationId: product.organizationId,
        ids,
      });
    }
    if (!insert || removeIds.length > 0) {
      log.info(
        { productId: product.id, inserted: insert, removedIds: removeIds },
        "deduped knowledge-base classification records",
      );
    }
  } catch (error) {
    log.error(
      { err: error, productId: product.id },
      "failed to dedupe classification records",
    );
  }
}
