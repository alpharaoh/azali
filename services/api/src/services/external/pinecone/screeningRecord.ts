import { createLogger } from "@/lib/logger";
import { KNOWLEDGE_RECORD_TYPES } from "./classificationRecord";
import { KnowledgeBaseService } from "./service";

const log = createLogger("knowledge-base");

/** The slice of a determination the screening record needs — satisfied by
 * both DB rows and workflow outcome objects. */
export interface ScreeningRecordDetermination {
  agencyCode: string;
  flagCode: string | null;
  determination: string;
  disclaimCode: string | null;
  rationale: string;
}

export interface PgaScreeningRecordInput {
  organizationId: string;
  clientId: string;
  /** Anchors the record; falls back to the line item for productless lines. */
  productId: string | null;
  lineItemId: string;
  description: string;
  htsCode: string;
  originCountry: string | null;
  determinations: ScreeningRecordDetermination[];
  /** "broker" = human-approved; "agent" = autopilot screening. */
  source: "broker" | "agent";
}

/**
 * A line's PGA screening as a knowledge-base record. The id is keyed on
 * product + origin — screening is origin-sensitive (the same product from a
 * different country can screen differently), so each (product, origin) pair
 * holds exactly one current screening; re-screening replaces it.
 */
export function screeningRecord(input: PgaScreeningRecordInput) {
  const anchor = input.productId ?? input.lineItemId;
  const origin = input.originCountry ?? "unknown";

  const outcomes = input.determinations.map((determination) => {
    const flag = determination.flagCode ? ` ${determination.flagCode}` : "";
    const disclaim = determination.disclaimCode
      ? ` (code ${determination.disclaimCode})`
      : "";
    return `- ${determination.agencyCode}${flag}: ${determination.determination}${disclaim} — ${determination.rationale}`;
  });

  return {
    id: `pga:${anchor}:${origin}`,
    text: [
      `Product: ${input.description}`,
      `HTS ${input.htsCode}, origin ${origin}`,
      "PGA screening:",
      ...(outcomes.length ? outcomes : ["- No agency requirements."]),
    ].join("\n"),
    metadata: {
      type: KNOWLEDGE_RECORD_TYPES.pgaScreening,
      clientId: input.clientId,
      productId: input.productId ?? input.lineItemId,
      htsCode: input.htsCode,
      originCountry: origin,
      agencies: input.determinations.map(
        (determination) => determination.agencyCode,
      ),
      source: input.source,
      verifiedAt: new Date().toISOString(),
    },
  };
}

/**
 * Upsert a line's screening record. Fire-and-forget like classification
 * indexing: precedent indexing must never fail a screening run or a review
 * resolution, so errors are logged and swallowed.
 */
export async function indexPgaScreening(
  input: PgaScreeningRecordInput,
): Promise<void> {
  try {
    await KnowledgeBaseService.upsert({
      organizationId: input.organizationId,
      documents: [screeningRecord(input)],
    });
  } catch (error) {
    log.error(
      { err: error, lineItemId: input.lineItemId },
      "failed to index pga screening record",
    );
  }
}
