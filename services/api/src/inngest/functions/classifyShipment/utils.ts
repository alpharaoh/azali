import type { LineItemStatus } from "@/db/schema";
import type {
  ClassificationResult,
  ClassificationShipmentFacts,
} from "@/services/agents/classification/service";

/** Slim line projection that travels between steps. */
export interface LineSlim {
  id: string;
  lineNumber: number;
  description: string;
  sku: string | null;
  quantity: number | null;
  unit: string | null;
  totalValueCents: number | null;
  originCountry: string | null;
  declaredHts: string | null;
  productId: string | null;
}

/** One line's classification outcome — fresh or reused from product memory. */
export interface LineOutcome {
  lineItemId: string;
  lineNumber: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  valueCents: number | null;
  htsCode: string;
  htsDescription: string | null;
  confidence: number;
  effectivePct: number | null;
  effective: string | null;
  reused: boolean;
  status: LineItemStatus;
  runId: string | null;
  result: ClassificationResult | null;
}

/** '2.6%' → 0.026, 'Free' → 0, anything else → null. */
export function parseAdValoremRate(rate: string): number | null {
  if (/^free$/i.test(rate.trim())) return 0;
  const match = rate.match(/^(\d+(?:\.\d+)?)%$/);
  return match ? Number(match[1]) / 100 : null;
}

export function buildReviewPayload(
  headline: LineOutcome & { result: ClassificationResult },
  lines: LineOutcome[],
  shipment: ClassificationShipmentFacts,
  deadlineAt: string,
) {
  const result = headline.result;
  const lineValueUsd = (headline.valueCents ?? shipment.valueCents) / 100;

  // Price everything off the EFFECTIVE rate (base + applicable overlays) —
  // a "Free" base line with a 25% Section 301 surcharge is anything but free.
  const proposedPct =
    result.dutyRate.effectivePct ??
    (parseAdValoremRate(result.dutyRate.general) ?? 0) * 100;
  const proposedAmountUsd = Math.round((lineValueUsd * proposedPct) / 100);

  // The card shows a short rate label next to the amount; the full duty
  // explanation (overlay reasoning, caveats) lives in the hover breakdown.
  const shortRate =
    result.dutyRate.effectivePct !== null
      ? `${result.dutyRate.effectivePct}% effective`
      : result.dutyRate.general;

  const alternateImpacts: Record<
    string,
    { amountUsd: number; deltaUsd: number }
  > = {};
  for (const alternate of result.alternates) {
    if (alternate.effectiveDutyPct === null) continue;
    const amountUsd = Math.round(
      (lineValueUsd * alternate.effectiveDutyPct) / 100,
    );
    alternateImpacts[alternate.code] = {
      amountUsd,
      deltaUsd: amountUsd - proposedAmountUsd,
    };
  }

  return {
    reviewType: "classification",
    question: `Which HTS code applies to ${headline.description.slice(0, 90)}?`,
    confidence: result.confidence,
    deadlineAt,
    // The uncertain line this review resolves.
    lineItemId: headline.lineItemId,
    lineNumber: headline.lineNumber,
    // The audit run behind the headline proposal.
    traceRunId: headline.runId,
    proposal: {
      label: "HTS",
      value: result.htsCode,
      detail: result.summary,
    },
    dutyImpact: {
      proposed: {
        rate: shortRate,
        amountUsd: proposedAmountUsd,
        breakdown: [
          `${result.htsCode}: ${result.dutyRate.general} (Column 1 General)`,
          ...result.overlays.map(
            (overlay) =>
              `${overlay.program} (${overlay.chapter99}): ${overlay.note}`,
          ),
          `Effective: ${result.dutyRate.effective} ≈ ${formatUsd(proposedAmountUsd)} on this line`,
        ],
      },
      ...(Object.keys(alternateImpacts).length > 0
        ? { alternates: alternateImpacts }
        : {}),
    },
    // The whole shipment's lines — the review renders the full picture.
    lineItems: lines.map((line) => ({
      lineItemId: line.lineItemId,
      lineNumber: line.lineNumber,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      valueUsd: line.valueCents === null ? null : line.valueCents / 100,
      htsCode: line.htsCode,
      confidence: line.confidence,
      status: line.status,
      reused: line.reused,
    })),
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
