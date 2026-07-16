import { z } from "zod";

/**
 * The anchored confidence rubric. Every submission names its band, and the
 * numeric confidence must fall inside it — enforced by
 * {@link calibrationViolations}.
 */
export const CONFIDENCE_BANDS = [
  { id: "effectively_settled", min: 0.93, max: 0.98 },
  { id: "clear_after_full_investigation", min: 0.83, max: 0.92 },
  { id: "favored_with_named_risk", min: 0.68, max: 0.82 },
  { id: "genuinely_contested", min: 0.5, max: 0.67 },
  { id: "insufficient_evidence", min: 0, max: 0.49 },
] as const;

export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number]["id"];

const CONFIDENCE_BAND_IDS = CONFIDENCE_BANDS.map((band) => band.id) as [
  ConfidenceBand,
  ...ConfidenceBand[],
];

/** The rubric band a numeric confidence falls in. */
export function confidenceBandForScore(score: number): ConfidenceBand {
  for (const band of CONFIDENCE_BANDS) {
    if (score >= band.min) return band.id;
  }
  return "insufficient_evidence";
}

export const classificationResultSchema = z.object({
  htsCode: z
    .string()
    .describe(
      "The final 10-digit HTS classification with dots, e.g. '8517.62.0020'.",
    ),
  description: z
    .string()
    .describe("The tariff line's article description for the chosen code."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Calibrated confidence per the anchored rubric. Must sit inside the declared confidenceBand, and every point of discount below 0.90 must map to a named entry in residualRisks. Never discount for unnamed, diffuse doubt or because the product category is generally hard.",
    ),
  confidenceBand: z
    .enum(CONFIDENCE_BAND_IDS)
    .describe(
      "The rubric band the confidence falls in: effectively_settled (0.93–0.98), clear_after_full_investigation (0.83–0.92), favored_with_named_risk (0.68–0.82), genuinely_contested (0.50–0.67, requires a recommendation), insufficient_evidence (<0.50, requires clarifyingQuestions).",
    ),
  residualRisks: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "The specific named risk, e.g. 'EN 85.13 table-lamp exclusion'. 'This is a complex area' is not a named risk.",
          ),
        type: z
          .enum(["irreducible", "resolvable_unresolved"])
          .describe(
            "irreducible = research cannot settle it (unsettled law, discretionary call). resolvable_unresolved = more research or better facts would settle it but did not — must be EMPTY for confidence >= 0.83.",
          ),
        flipCode: z
          .string()
          .nullable()
          .describe(
            "The HTS code the classification flips to if this risk materializes, when identifiable.",
          ),
        flipDuty: z
          .string()
          .nullable()
          .describe(
            "The effective duty picture under the flip code, e.g. '31%'.",
          ),
        basis: z
          .string()
          .describe(
            "The authority behind the risk, e.g. 'EN 85.13 excludes lamps designed for placing on a table'.",
          ),
      }),
    )
    .describe(
      "Every discount below 0.90 maps to an entry here. Empty when the classification is effectively settled.",
    ),
  loadBearingPremises: z
    .array(
      z.object({
        premise: z
          .string()
          .describe(
            "A premise that flips the heading if negated, e.g. 'lamp component classifies to 8513 not 9405'.",
          ),
        independentlyInvestigated: z
          .boolean()
          .describe(
            "Whether this premise was independently verified this run (EN/note text read, rulings on that specific boundary searched) — not merely assumed.",
          ),
        authority: z
          .string()
          .describe(
            "The lookups backing it, e.g. 'EN 85.13; HQ W968278; ruling search \"rechargeable table lamp\" (3 hits reviewed)'.",
          ),
      }),
    )
    .describe(
      "The premises the reasoning chain stands on. Final confidence may not exceed confidence in the weakest premise.",
    ),
  researchTier: z
    .number()
    .int()
    .min(1)
    .max(3)
    .describe(
      "The research tier executed: 1 routine, 2 standard, 3 deep. Tiers escalate mid-run, never de-escalate.",
    ),
  counterCaseSearch: z
    .string()
    .nullable()
    .describe(
      "Tier 3 only (null otherwise): the search made specifically to find evidence AGAINST the leading candidate, and the best opposing argument found — e.g. 'performed — best opposing argument: H309868 co-equal finding; addressed in rationale'.",
    ),
  recommendation: z
    .object({
      filingCode: z
        .string()
        .describe(
          "The code to file under while the question is contested — typically the conservative (higher-duty) candidate.",
        ),
      bindingRuling: z
        .boolean()
        .describe("Whether to request a CBP binding ruling."),
      recoveryStrategy: z
        .string()
        .describe(
          "How to recover duty if the favorable code prevails, e.g. 'protest / PSC within 180 days of liquidation'.",
        ),
    })
    .nullable()
    .describe(
      "Mandatory when genuinely_contested (0.50–0.67): the decisiveness lives here, not in an inflated score. Null in higher bands.",
    ),
  griPath: z
    .array(
      z.object({
        rule: z
          .string()
          .describe("The GRI applied, e.g. 'GRI 1', 'GRI 3(b)', 'GRI 6'."),
        finding: z.string().describe("What the rule resolved and why."),
      }),
    )
    .describe("The ordered GRI walk that produced the classification."),
  notesApplied: z
    .array(
      z.object({
        ref: z
          .string()
          .describe("E.g. 'Section XVI Note 3', 'Chapter 85 Note 6'."),
        effect: z
          .string()
          .describe("How the note included, excluded, or directed."),
      }),
    )
    .describe("The binding Section/Chapter Notes that governed the decision."),
  alternates: z
    .array(
      z.object({
        code: z.string().describe("The rejected candidate HTS code."),
        description: z.string().describe("Its tariff description."),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .describe(
            "Residual probability this candidate is correct. A candidate defeated on the documented facts gets <= 0.03 — do not smear probability onto defeated alternates to look humble.",
          ),
        reason: z
          .string()
          .describe(
            "Why it scored what it did and why it was not chosen — cite the Note, GRI, or ruling that defeats it.",
          ),
        effectiveDutyRate: z
          .string()
          .nullable()
          .describe(
            "This candidate's effective duty picture for THIS shipment in one line, overlays included, e.g. '3.5% + 25% Section 301 = 28.5%'.",
          ),
        effectiveDutyPct: z
          .number()
          .nullable()
          .describe(
            "This candidate's total effective ad valorem percentage for this shipment's origin (base + applicable overlays), e.g. 28.5. Null when not purely ad valorem.",
          ),
      }),
    )
    .describe("Candidate codes considered and rejected, strongest first."),
  citations: z
    .array(
      z.object({
        kind: z.enum(["ruling", "regulation", "evidence"]),
        ref: z
          .string()
          .describe("E.g. 'NY N238460', 'Section XVI Note 3', 'Spec sheet'."),
        quote: z.string().describe("The load-bearing language, verbatim."),
        href: z
          .string()
          .nullable()
          .describe("Source URL when public (rulings.cbp.gov, hts.usitc.gov)."),
      }),
    )
    .describe("Every source the classification relies on."),
  overlays: z
    .array(
      z.object({
        program: z
          .string()
          .describe("E.g. 'Section 301 (China)', 'Section 232 (steel)'."),
        chapter99: z
          .string()
          .describe("The Chapter 99 subheading, e.g. '9903.88.15'."),
        note: z
          .string()
          .describe(
            "Applicability given the country of origin, and the added rate if stated.",
          ),
      }),
    )
    .describe(
      "Chapter 99 additional-duty programs flagged on the chosen line, assessed against the shipment's origin.",
    ),
  dutyRate: z.object({
    general: z
      .string()
      .describe("Column 1 General rate, e.g. 'Free' or '2.6%'."),
    special: z
      .string()
      .nullable()
      .describe("Preferential program rates, when present."),
    effective: z
      .string()
      .describe(
        "The effective duty picture for this shipment in one line, including overlays, e.g. 'Free + 7.5% Section 301 (List 4A) = 7.5%'.",
      ),
    effectivePct: z
      .number()
      .nullable()
      .describe(
        "The total effective ad valorem percentage for THIS shipment (Column 1 General + applicable overlays), e.g. 7.5. Null when not purely ad valorem.",
      ),
  }),
  clarifyingQuestions: z
    .array(z.string())
    .describe(
      "Targeted questions for the importer that would resolve uncertainties the documents cannot — each converts a resolvable_unresolved risk into a missing fact. Empty when confident.",
    ),
  summary: z
    .string()
    .describe(
      "One paragraph: what the product is, the classification, and the decisive reasoning.",
    ),
});

export type ClassificationResult = z.infer<typeof classificationResultSchema>;

/**
 * Deterministic calibration checks on a submitted classification. Violations
 * are sent back through the repair turn; an empty array means the submission
 * is internally consistent with the rubric.
 */
export function calibrationViolations(result: ClassificationResult): string[] {
  const violations: string[] = [];

  const band = CONFIDENCE_BANDS.find((b) => b.id === result.confidenceBand);
  if (band && (result.confidence < band.min || result.confidence > band.max)) {
    violations.push(
      `confidence ${result.confidence} is outside the declared band "${band.id}" (${band.min}–${band.max}) — the band for ${result.confidence} is "${confidenceBandForScore(result.confidence)}"`,
    );
  }

  if (result.confidence >= 0.83) {
    const unresolved = result.residualRisks.filter(
      (risk) => risk.type === "resolvable_unresolved",
    );
    if (unresolved.length > 0) {
      violations.push(
        `confidence >= 0.83 with unresolved resolvable risks (${unresolved
          .map((risk) => risk.name)
          .join(
            "; ",
          )}) — resolve them with more research, document why they cannot be resolved (converting them to clarifyingQuestions), or lower the score`,
      );
    }

    const uninvestigated = result.loadBearingPremises.filter(
      (premise) => !premise.independentlyInvestigated,
    );
    if (uninvestigated.length > 0) {
      violations.push(
        `confidence >= 0.83 with uninvestigated load-bearing premises (${uninvestigated
          .map((premise) => premise.premise)
          .join("; ")}) — investigate each premise or lower the score`,
      );
    }

    const inflatedAlternates = result.alternates.filter(
      (alternate) => alternate.confidence > 0.05,
    );
    if (inflatedAlternates.length > 0) {
      violations.push(
        `confidence >= 0.83 requires every alternate to be a formality (<= 0.05); ${inflatedAlternates
          .map((alternate) => `${alternate.code}@${alternate.confidence}`)
          .join(
            ", ",
          )} exceed that — either the alternate is live (lower the primary) or it is defeated (score it <= 0.03)`,
      );
    }
  }

  if (
    result.confidenceBand === "genuinely_contested" &&
    !result.recommendation
  ) {
    violations.push(
      "genuinely_contested submissions must carry a recommendation (conservative filing code, binding-ruling decision, recovery strategy)",
    );
  }

  if (result.researchTier === 3 && !result.counterCaseSearch) {
    violations.push(
      "researchTier 3 requires counterCaseSearch — search for the best case AGAINST the leading candidate and report it",
    );
  }

  if (
    result.confidenceBand === "insufficient_evidence" &&
    result.clarifyingQuestions.length === 0
  ) {
    violations.push(
      "insufficient_evidence submissions must list the clarifyingQuestions that would make the product classifiable",
    );
  }

  return violations;
}
