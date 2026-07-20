import { z } from "zod";
import type { PgaFlagMatch } from "@/services/pga/flagLookup";
import {
  CONFIDENCE_BANDS,
  type ConfidenceBand,
  confidenceBandForScore,
} from "../classification/schema";

const CONFIDENCE_BAND_IDS = CONFIDENCE_BANDS.map((band) => band.id) as [
  ConfidenceBand,
  ...ConfidenceBand[],
];

const determinationSchema = z.object({
  agencyCode: z
    .string()
    .describe("The ACE agency code, e.g. 'FDA', 'APH', 'EPA', 'NHT', 'FWS'."),
  agencyName: z
    .string()
    .describe("Human-readable agency name, e.g. 'Food and Drug Administration'."),
  programCode: z
    .string()
    .nullable()
    .describe(
      "The specific agency program in play (e.g. 'FOO', 'APL', 'VNE') when determinable, else null.",
    ),
  flagCode: z
    .string()
    .nullable()
    .describe(
      "The tariff flag that surfaced this agency (e.g. 'FD1', 'AQ2'). Null when the agency was surfaced by your jurisdiction sweep rather than a flag.",
    ),
  flagSource: z
    .enum(["flag_table", "jurisdictional_analysis"])
    .describe(
      "flag_table = surfaced by the deterministic ACE flag lookup. jurisdictional_analysis = you identified likely jurisdiction despite no flag (flag tables lag HTS revisions).",
    ),
  requirement: z
    .enum(["may_be_required", "required"])
    .nullable()
    .describe(
      "The flag's variant: may_be_required ('1'-type flags) or required ('2'-type). Null for jurisdictional_analysis rows.",
    ),
  determination: z
    .enum(["required", "disclaim", "not_applicable"])
    .describe(
      "required = the agency's data must be filed with this entry (message set). disclaim = the flag fires but the agency does not regulate THIS shipment — a formal coded disclaimer is filed. not_applicable = no filing obligation and no disclaim needed (e.g. jurisdictional analysis concluded the agency is not in play).",
    ),
  disclaimCode: z
    .string()
    .nullable()
    .describe(
      "The disclaim code (A–E) when determination = disclaim, respecting agency-specific restrictions (e.g. EH1 allows only A; FW1 only C/D/E; TB3 only A/C). Null otherwise.",
    ),
  rationale: z
    .string()
    .describe(
      "Why this determination holds for THIS shipment — grounded in product attributes, country of origin, intended use, and manufacturing facts, not just the HTS code.",
    ),
  dataElements: z
    .array(
      z.object({
        name: z
          .string()
          .describe("The required data element, e.g. 'FDA product code', 'Prior Notice confirmation number', 'HS-7 box'."),
        description: z.string().describe("What the element is and why the agency needs it."),
        present: z
          .boolean()
          .describe("Whether the shipment documents already contain it."),
        sourceDocument: z
          .string()
          .nullable()
          .describe("The document it was found in, when present."),
      }),
    )
    .describe(
      "For determination = required: the data elements the agency's filing needs, each marked present or missing against the shipment documents. Empty for disclaim / not_applicable.",
    ),
  citations: z
    .array(
      z.object({
        kind: z.enum(["regulation", "guidance", "flag_table", "evidence"]),
        ref: z
          .string()
          .describe("E.g. 'ACE Agency Tariff Code Reference 0875-0419', '21 CFR 1.276', 'APHIS Core ACE Guide'."),
        quote: z.string().describe("The load-bearing language, verbatim."),
        href: z.string().nullable().describe("Source URL when public."),
      }),
    )
    .describe("Every authority this determination relies on."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Calibrated confidence in THIS determination per the anchored rubric. Must sit inside the declared confidenceBand.",
    ),
  confidenceBand: z
    .enum(CONFIDENCE_BAND_IDS)
    .describe(
      "The rubric band the confidence falls in — same anchored rubric as classification.",
    ),
  residualRisks: z
    .array(
      z.object({
        name: z.string().describe("The specific named risk."),
        type: z.enum(["irreducible", "resolvable_unresolved"]),
        basis: z.string().describe("The authority or fact gap behind the risk."),
      }),
    )
    .describe("Named risks accounting for any discount below 0.90."),
});

export const pgaScreeningResultSchema = z.object({
  determinations: z
    .array(determinationSchema)
    .describe(
      "One entry per agency in play for this line — every flag from the lookup MUST appear here (as required, disclaim, or not_applicable), plus any agency your jurisdiction sweep surfaced.",
    ),
  jurisdictionSweep: z
    .string()
    .describe(
      "The agencies you considered BEYOND the flag lookup and why each is in or out — flags are a prior, not ground truth; flag tables lag HTS revisions. E.g. 'Product is a food-contact container: FDA analyzed despite no flag (out — not food itself, no 801(a) trigger); no wood packaging declared (APHIS out); not vehicle/engine (EPA/NHTSA out).'",
    ),
  flagTableVersion: z
    .string()
    .describe(
      "The flag-table publication cited, echoed exactly from the lookup result (e.g. '0875-0419 (2026-03-04)')."),
  clarifyingQuestions: z
    .array(z.string())
    .describe(
      "Targeted questions for the importer that would resolve determinations the documents cannot — e.g. intended use, food-contact status, manufacturing method. Empty when everything is determinable.",
    ),
  summary: z
    .string()
    .describe(
      "One paragraph: which agencies are in play for this line, what gets filed vs disclaimed, and what (if anything) is missing.",
    ),
});

export type PgaScreeningResult = z.infer<typeof pgaScreeningResultSchema>;
export type PgaDetermination = z.infer<typeof determinationSchema>;

/**
 * Deterministic calibration checks on a submitted screening. Violations are
 * sent back through the repair turn; empty means the submission is
 * internally consistent with the rubric and covers every looked-up flag.
 */
export function pgaCalibrationViolations(
  result: PgaScreeningResult,
  lookedUpFlags: PgaFlagMatch[],
): string[] {
  const violations: string[] = [];

  // Every flag from the deterministic lookup must be dispositioned — a
  // silently dropped flag is a compliance hole, not an omission.
  const covered = new Set(
    result.determinations
      .filter((determination) => determination.flagCode)
      .map(
        (determination) =>
          `${determination.agencyCode}:${determination.flagCode}`,
      ),
  );
  for (const flag of lookedUpFlags) {
    if (!covered.has(`${flag.agencyCode}:${flag.flagCode}`)) {
      violations.push(
        `flag ${flag.flagCode} (${flag.agencyCode}) from the lookup has no determination — every flagged agency must be dispositioned as required, disclaim, or not_applicable`,
      );
    }
  }

  for (const determination of result.determinations) {
    const label = `${determination.agencyCode}${determination.flagCode ? `/${determination.flagCode}` : ""}`;

    if (
      determination.determination === "disclaim" &&
      !determination.disclaimCode
    ) {
      violations.push(
        `${label}: disclaim determinations must carry a disclaimCode (A–E, respecting the flag's restrictions)`,
      );
    }

    if (
      determination.determination === "required" &&
      determination.dataElements.length === 0
    ) {
      violations.push(
        `${label}: required determinations must list the agency's data elements, each marked present or missing`,
      );
    }

    if (
      determination.flagSource === "jurisdictional_analysis" &&
      !determination.citations.some(
        (citation) =>
          citation.kind === "regulation" || citation.kind === "guidance",
      )
    ) {
      violations.push(
        `${label}: jurisdictional_analysis determinations must cite at least one regulation or guidance source — a hunch is not jurisdiction`,
      );
    }

    const band = CONFIDENCE_BANDS.find(
      (candidate) => candidate.id === determination.confidenceBand,
    );
    if (
      band &&
      (determination.confidence < band.min ||
        determination.confidence > band.max)
    ) {
      violations.push(
        `${label}: confidence ${determination.confidence} is outside the declared band "${band.id}" (${band.min}–${band.max}) — the band for ${determination.confidence} is "${confidenceBandForScore(determination.confidence)}"`,
      );
    }

    if (
      determination.confidence < 0.5 &&
      result.clarifyingQuestions.length === 0
    ) {
      violations.push(
        `${label}: insufficient-evidence determinations must come with clarifyingQuestions that would make the call determinable`,
      );
    }
  }

  return violations;
}
