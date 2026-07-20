import { generateText, Output } from "ai";
import { z } from "zod";
import type {
  PgaDetermination,
  PgaScreeningResult,
} from "@/services/agents/pga/schema";
import type {
  ClassificationDocument,
  ClassificationShipmentFacts,
} from "@/services/agents/classification/service";
import { anthropic } from "@/services/external/anthropic/client";
import type { PgaFlagLookupResult } from "@/services/pga/flagLookup";

/** Slim line projection that travels between steps — classified lines only. */
export interface PgaLineSlim {
  id: string;
  lineNumber: number;
  description: string;
  sku: string | null;
  quantity: number | null;
  unit: string | null;
  totalValueCents: number | null;
  originCountry: string | null;
  htsCode: string;
  htsDescription: string | null;
  classificationSummary: string | null;
  productId: string | null;
}

/** One line's screening outcome — full agent run or clean triage. */
export interface PgaLineOutcome {
  lineItemId: string;
  lineNumber: number;
  description: string;
  htsCode: string;
  determinations: Array<
    PgaDetermination & { determinationId: string | null }
  >;
  clarifyingQuestions: string[];
  jurisdictionSweep: string | null;
  summary: string | null;
  runId: string | null;
  /** True when the line short-circuited: no flags and a clean triage. */
  triagedClean: boolean;
}

const TRIAGE_MODEL = "claude-sonnet-4-6";

const triageSchema = z.object({
  plausibleAgencies: z
    .array(
      z.object({
        agency: z.string().describe("Agency code, e.g. 'FDA', 'APH', 'EPA'."),
        reason: z
          .string()
          .describe("Why this agency plausibly has jurisdiction over this product."),
      }),
    )
    .describe("Agencies that plausibly regulate this product despite no tariff flag. Empty when the product is clearly outside every agency's scope."),
  clean: z
    .boolean()
    .describe("True when no agency plausibly has jurisdiction — the line can pass without a full screening run."),
  rationale: z
    .string()
    .describe("One or two sentences: why the line is clean, or which agency needs a closer look and why."),
});

export type PgaTriage = z.infer<typeof triageSchema>;

/**
 * The cheap jurisdiction check for UNFLAGGED lines. Flags are a prior, not
 * ground truth — but paying a full agent run for every box of screwdrivers
 * is waste. One small-model pass decides: clearly outside every agency's
 * scope (clean), or plausible jurisdiction (full agent run, seeded with the
 * suspicion).
 */
export async function triageUnflaggedLine(
  line: PgaLineSlim,
  shipment: ClassificationShipmentFacts,
  documents: ClassificationDocument[],
): Promise<PgaTriage> {
  const documentSummaries = documents
    .map((document) => `- ${document.fileName}: ${document.extraction.summary}`)
    .join("\n");

  const { output } = await generateText({
    model: anthropic(TRIAGE_MODEL),
    output: Output.object({ schema: triageSchema }),
    telemetry: { functionId: "pga-triage" },
    prompt: `You are screening a US import shipment line for Partner Government Agency jurisdiction. The line's HTS code carries NO PGA flags in CBP's ACE flag table — but flag tables lag HTS revisions, so decide from the product itself whether any agency plausibly regulates it.

Line: ${line.description}
HTS code: ${line.htsCode}${line.htsDescription ? ` — ${line.htsDescription}` : ""}
Country of origin: ${line.originCountry ?? shipment.originCountry}
${line.classificationSummary ? `Classification rationale: ${line.classificationSummary}` : ""}

Shipment documents:
${documentSummaries}

Consider: FDA (food, food-contact, cosmetics, drugs, devices, radiation-emitting); APHIS (plants, wood, animal products, Lacey Act); FSIS (meat/poultry/egg); AMS (shell eggs, marketing orders, organics); EPA (vehicles/engines, chemicals/TSCA, pesticides, refrigerants); NHTSA (vehicles/equipment); FWS (wildlife-derived materials); NMFS (seafood); TTB (alcohol/tobacco); CPSC (consumer product safety); DEA (controlled substances/listed chemicals).

Mark clean=true ONLY when the product is clearly outside every agency's scope. When in doubt, name the agency — a false "plausible" costs one screening run; a false "clean" is a compliance hole.`,
  });

  return output;
}

/** Aggregate rollup stored on shipments.summary.pga. */
export function buildPgaSummary(outcomes: PgaLineOutcome[]) {
  const determinations = outcomes.flatMap((outcome) => outcome.determinations);
  return {
    agencies: [
      ...new Set(
        determinations
          .filter(
            (determination) => determination.determination !== "not_applicable",
          )
          .map((determination) => determination.agencyCode),
      ),
    ],
    requiredCount: determinations.filter(
      (determination) => determination.determination === "required",
    ).length,
    disclaimCount: determinations.filter(
      (determination) => determination.determination === "disclaim",
    ).length,
    lineCount: outcomes.length,
  };
}

/**
 * The review payload for reviewType "pga" — everything the review UI renders.
 * Shape parallels the classification payload where the UI reuses components
 * (question, confidence, deadlineAt, citations, traceRunId, lineItems).
 */
export function buildPgaReviewPayload(
  outcomes: PgaLineOutcome[],
  shipment: ClassificationShipmentFacts,
  flagVersion: { pubNumber: string; publishedAt: string },
  deadlineAt: string,
) {
  const agencies = outcomes.flatMap((outcome) =>
    outcome.determinations.map((determination) => ({
      determinationId: determination.determinationId,
      lineItemId: outcome.lineItemId,
      lineNumber: outcome.lineNumber,
      lineDescription: outcome.description,
      agencyCode: determination.agencyCode,
      agencyName: determination.agencyName,
      programCode: determination.programCode,
      flagCode: determination.flagCode,
      flagSource: determination.flagSource,
      requirement: determination.requirement,
      determination: determination.determination,
      disclaimCode: determination.disclaimCode,
      rationale: determination.rationale,
      confidence: determination.confidence,
      dataElements: determination.dataElements,
      citations: determination.citations,
      runId: outcome.runId,
    })),
  );

  const flagged = agencies
    .filter((agency) => agency.determination !== "not_applicable")
    .sort((a, b) => a.confidence - b.confidence);
  const headline = flagged[0] ?? agencies[0] ?? null;
  const clarifyingQuestions = [
    ...new Set(outcomes.flatMap((outcome) => outcome.clarifyingQuestions)),
  ];
  const inPlay = [
    ...new Set(
      agencies
        .filter((agency) => agency.determination !== "not_applicable")
        .map((agency) => agency.agencyCode),
    ),
  ];

  return {
    reviewType: "pga",
    question:
      inPlay.length > 0
        ? `Resolve ${flagged.length} agency requirement${flagged.length === 1 ? "" : "s"} (${inPlay.join(", ")}) across ${outcomes.length} line${outcomes.length === 1 ? "" : "s"}`
        : `Confirm PGA screening for ${outcomes.length} line${outcomes.length === 1 ? "" : "s"}`,
    confidence: agencies.length
      ? Math.min(...agencies.map((agency) => agency.confidence))
      : null,
    deadlineAt,
    flagTableVersion: flagVersion,
    // Header fallback for generic review rendering.
    proposal: {
      label: "PGA screening",
      value: inPlay.length ? inPlay.join(" · ") : "No agencies in play",
      detail:
        outcomes.find((outcome) => outcome.summary)?.summary ??
        "Partner Government Agency screening across the shipment's lines.",
    },
    lineItemId: headline?.lineItemId ?? null,
    lineNumber: headline?.lineNumber ?? null,
    traceRunId: headline?.runId ?? null,
    pgaAgencies: agencies,
    lineItems: outcomes.map((outcome) => ({
      lineItemId: outcome.lineItemId,
      lineNumber: outcome.lineNumber,
      description: outcome.description,
      htsCode: outcome.htsCode,
      runId: outcome.runId,
      summary: outcome.summary,
      agencies: outcome.determinations.map(
        (determination) =>
          `${determination.agencyCode}: ${determination.determination}${determination.disclaimCode ? ` (${determination.disclaimCode})` : ""}`,
      ),
    })),
    citations: agencies.flatMap((agency) => agency.citations),
    clarifyingQuestions,
    approveLabel: "Approve PGA screening",
    canRequestInfo: clarifyingQuestions.length > 0,
  };
}

/** Compact per-line event title, e.g. "Line 2: FDA required · APH disclaimed (A)". */
export function describeLineScreening(
  result: Pick<PgaScreeningResult, "determinations">,
): string {
  const parts = result.determinations
    .filter((determination) => determination.determination !== "not_applicable")
    .map((determination) => {
      if (determination.determination === "required") {
        return `${determination.agencyCode}${determination.flagCode ? ` ${determination.flagCode}` : ""} required`;
      }
      return `${determination.agencyCode} disclaimed${determination.disclaimCode ? ` (${determination.disclaimCode})` : ""}`;
    });
  return parts.length ? parts.join(" · ") : "no agencies in play";
}
