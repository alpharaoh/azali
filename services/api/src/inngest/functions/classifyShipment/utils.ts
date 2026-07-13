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
  const valueUsd = shipment.valueCents / 100;

  // Price everything off the EFFECTIVE rate (base + applicable overlays) —
  // a "Free" base line with a 25% Section 301 surcharge is anything but free.
  const proposedPct =
    result.dutyRate.effectivePct ??
    (parseAdValoremRate(result.dutyRate.general) ?? 0) * 100;
  const proposedAmountUsd = Math.round((valueUsd * proposedPct) / 100);

  const alternateImpacts: Record<
    string,
    { amountUsd: number; deltaUsd: number }
  > = {};
  for (const alternate of result.alternates) {
    if (alternate.effectiveDutyPct === null) continue;
    const amountUsd = Math.round((valueUsd * alternate.effectiveDutyPct) / 100);
    alternateImpacts[alternate.code] = {
      amountUsd,
      deltaUsd: amountUsd - proposedAmountUsd,
    };
  }

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
        amountUsd: proposedAmountUsd,
        breakdown: [
          `${result.htsCode}: ${result.dutyRate.general} (Column 1 General)`,
          ...result.overlays.map(
            (overlay) =>
              `${overlay.program} (${overlay.chapter99}): ${overlay.note}`,
          ),
          `Effective: ${result.dutyRate.effective} ≈ ${formatUsd(proposedAmountUsd)} on this shipment`,
        ],
      },
      ...(Object.keys(alternateImpacts).length > 0
        ? { alternates: alternateImpacts }
        : {}),
    },
    alternates: result.alternates.map((alternate) => ({
      value: alternate.code,
      detail: alternate.effectiveDutyRate
        ? `${alternate.description} — duty ${alternate.effectiveDutyRate}`
        : alternate.description,
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

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}
