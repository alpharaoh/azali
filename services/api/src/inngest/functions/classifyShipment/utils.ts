import type {
  ClassificationResult,
  ClassificationShipmentFacts,
} from "@/services/agents/classification/service";

export interface ClassifyContext {
  organizationId: string;
  userId: string;
}

/** '2.6%' → 0.026, 'Free' → 0, anything else → null. */
export function parseAdValoremRate(rate: string): number | null {
  if (/^free$/i.test(rate.trim())) return 0;
  const match = rate.match(/^(\d+(?:\.\d+)?)%$/);
  return match ? Number(match[1]) / 100 : null;
}

export function buildReviewPayload(
  result: ClassificationResult,
  shipment: ClassificationShipmentFacts,
  deadlineAt: string,
) {
  const rate = parseAdValoremRate(result.dutyRate.general);
  const valueUsd = shipment.valueCents / 100;

  return {
    reviewType: "classification",
    question: `Which HTS code applies to the goods on ${shipment.reference}?`,
    confidence: result.confidence,
    deadlineAt,
    proposal: {
      label: "HTS",
      value: result.htsCode,
      detail: result.summary,
    },
    dutyImpact: {
      proposed: {
        rate: result.dutyRate.effective,
        amountUsd: rate === null ? 0 : Math.round(valueUsd * rate),
        breakdown: [
          `${result.htsCode}: ${result.dutyRate.general} (Column 1 General)`,
          ...result.overlays.map(
            (overlay) =>
              `${overlay.program} (${overlay.chapter99}): ${overlay.note}`,
          ),
          `Effective: ${result.dutyRate.effective}`,
        ],
      },
    },
    alternates: result.alternates.map((alternate) => ({
      value: alternate.code,
      detail: alternate.description,
      confidence: alternate.confidence,
      reason: alternate.reason,
    })),
    citations: result.citations.map((citation) => ({
      kind: citation.kind,
      ref: citation.ref,
      quote: citation.quote,
      ...(citation.href ? { href: citation.href } : {}),
    })),
    clarifyingQuestions: result.clarifyingQuestions,
    approveLabel: "Approve classification",
    canRequestInfo: result.clarifyingQuestions.length > 0,
  };
}
