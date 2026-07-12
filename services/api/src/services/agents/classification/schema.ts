import { z } from "zod";

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
      "Calibrated confidence. 0.95+ only when the heading text, the binding Notes, and precedent all align with no plausible competing heading. Competing candidates, thin evidence, or unresolved product attributes must lower it.",
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
          .describe("Residual probability this candidate is correct."),
        reason: z
          .string()
          .describe(
            "Why it scored what it did and why it was not chosen — cite the Note, GRI, or ruling that defeats it.",
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
        "The effective duty picture for this shipment in one line, including overlays, e.g. 'Free + 7.5% Section 301 (List 4A)'.",
      ),
  }),
  clarifyingQuestions: z
    .array(z.string())
    .describe(
      "Questions for the importer that would resolve the divergence between candidates. Empty when confident.",
    ),
  summary: z
    .string()
    .describe(
      "One paragraph: what the product is, the classification, and the decisive reasoning.",
    ),
});

export type ClassificationResult = z.infer<typeof classificationResultSchema>;
