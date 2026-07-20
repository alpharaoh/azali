import { generateText, Output } from "ai";
import { z } from "zod";
import type {
  ClassificationDocument,
  ClassificationShipmentFacts,
} from "@/services/agents/classification/service";
import {
  buildPgaScreeningMemo,
  type PgaMemoLine,
} from "@/services/agents/pga/memo";
import {
  PGA_TRIAGE_PROMPT,
  PGA_TRIAGE_PROMPT_NAME,
} from "@/services/agents/pga/prompt";
import type {
  PgaDetermination,
  PgaScreeningResult,
} from "@/services/agents/pga/schema";
import { anthropic } from "@/services/external/anthropic/client";
import { resolvePrompt } from "@/services/external/langfuse/prompts";

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
  determinations: Array<PgaDetermination & { determinationId: string | null }>;
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
          .describe(
            "Why this agency plausibly has jurisdiction over this product.",
          ),
      }),
    )
    .describe(
      "Agencies that plausibly regulate this product despite no tariff flag. Empty when the product is clearly outside every agency's scope.",
    ),
  clean: z
    .boolean()
    .describe(
      "True when no agency plausibly has jurisdiction — the line can pass without a full screening run.",
    ),
  rationale: z
    .string()
    .describe(
      "One or two sentences: why the line is clean, or which agency needs a closer look and why.",
    ),
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

  const { text: prompt } = await resolvePrompt(
    PGA_TRIAGE_PROMPT_NAME,
    PGA_TRIAGE_PROMPT,
    {
      lineDescription: line.description,
      htsCode: line.htsCode,
      htsDescription: line.htsDescription ? ` — ${line.htsDescription}` : "",
      originCountry: line.originCountry ?? shipment.originCountry,
      classificationSummary: line.classificationSummary
        ? `Classification rationale: ${line.classificationSummary}`
        : "",
      documentSummaries,
    },
  );

  const { output } = await generateText({
    model: anthropic(TRIAGE_MODEL),
    output: Output.object({ schema: triageSchema }),
    telemetry: { functionId: "pga-triage" },
    prompt,
  });

  return output;
}

/**
 * The pga_memo_drafted event payload — same document shape as the
 * classification memo events, so the memo renders (and is broker-editable)
 * in the existing document plane.
 */
export function buildPgaMemoPayload(
  line: PgaMemoLine,
  shipment: { reference: string; clientName: string | null },
) {
  const inPlay = line.determinations.filter(
    (determination) => determination.determination !== "not_applicable",
  );
  const filings = inPlay.filter(
    (determination) => determination.determination === "required",
  ).length;
  const disclaims = inPlay.filter(
    (determination) => determination.determination === "disclaim",
  ).length;
  const outcome =
    inPlay.length === 0
      ? "Clean — no requirements"
      : [
          filings > 0 ? `${filings} filing${filings === 1 ? "" : "s"}` : null,
          disclaims > 0
            ? `${disclaims} disclaim${disclaims === 1 ? "" : "s"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return {
    kind: "pdf",
    name: `Screening Memo — Line ${line.lineNumber} · ${line.description.slice(0, 50)}`,
    meta: "Azali · PGA screening",
    lines: [
      { label: "Line", value: `#${line.lineNumber}` },
      { label: "HTS", value: line.htsCode },
      {
        label: "Agencies",
        value:
          [
            ...new Set(inPlay.map((determination) => determination.agencyCode)),
          ].join(", ") || "None",
      },
      { label: "Outcome", value: outcome },
    ],
    draft: buildPgaScreeningMemo(line, shipment),
  };
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
  flagVersion: { publishedAt: string },
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
