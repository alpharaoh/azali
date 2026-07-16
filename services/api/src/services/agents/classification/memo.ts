import { bold, bullets, heading, italic, paragraph } from "@/lib/tiptap";
import type { ClassificationResult, ConfidenceBand } from "./schema";

const BAND_LABELS: Record<ConfidenceBand, string> = {
  effectively_settled: "effectively settled",
  clear_after_full_investigation: "clear after full investigation",
  favored_with_named_risk: "favored with a named risk",
  genuinely_contested: "genuinely contested",
  insufficient_evidence: "insufficient evidence",
};

/**
 * The contemporaneous rationale memo — the reasonable-care record behind the
 * classification, in the same structure as the broker-authored memos.
 */
export function buildClassificationMemo(
  result: ClassificationResult,
  shipment: { reference: string; clientName: string | null },
): Record<string, unknown> {
  const content: Array<Record<string, unknown>> = [
    heading(2, `Classification Rationale Memo — ${shipment.reference}`),
    paragraph(
      italic(
        `Prepared by Azali · ${shipment.clientName ?? "Importer"} · Confidence ${result.confidence.toFixed(2)} (${BAND_LABELS[result.confidenceBand]}) · Research tier ${result.researchTier} · ${result.alternates.length} alternate${result.alternates.length === 1 ? "" : "s"} rejected`,
      ),
    ),
    heading(3, "I. Facts"),
    paragraph(result.summary),
    heading(3, "II. GRI analysis"),
    bullets(
      result.griPath.map((step) => [bold(step.rule), ` — ${step.finding}`]),
    ),
  ];

  if (result.notesApplied.length > 0) {
    content.push(
      paragraph("Binding notes applied:"),
      bullets(
        result.notesApplied.map((note) => [
          bold(note.ref),
          ` — ${note.effect}`,
        ]),
      ),
    );
  }

  if (result.alternates.length > 0) {
    content.push(
      heading(3, "III. Alternatives considered and rejected"),
      bullets(
        result.alternates.map((alternate) => [
          bold(`${alternate.code} (${alternate.confidence.toFixed(2)})`),
          ` — ${alternate.reason}`,
        ]),
      ),
    );
  }

  const precedent = result.citations.filter((c) => c.kind === "ruling");
  content.push(heading(3, "IV. Precedent & measures"));
  if (precedent.length > 0) {
    content.push(
      bullets(
        precedent.map((citation) => [
          bold(citation.ref),
          ` — "${citation.quote}"`,
        ]),
      ),
    );
  }
  content.push(
    paragraph(
      result.overlays.length > 0
        ? `Additional measures: ${result.overlays
            .map((o) => `${o.program} (${o.chapter99}) — ${o.note}`)
            .join("; ")}.`
        : "No Chapter 99 additional-duty measures apply to this line and origin.",
    ),
  );

  // The calibration record — every point of confidence discount traces to a
  // named residual risk, and each load-bearing premise shows its authority.
  content.push(heading(3, "V. Residual risk & calibration"));
  content.push(
    result.residualRisks.length > 0
      ? bullets(
          result.residualRisks.map((risk) => [
            bold(`${risk.name} (${risk.type.replace(/_/g, " ")})`),
            ` — ${risk.basis}${
              risk.flipCode
                ? `; flips to ${risk.flipCode}${risk.flipDuty ? ` at ${risk.flipDuty}` : ""}`
                : ""
            }`,
          ]),
        )
      : paragraph(
          "No residual risks — every material uncertainty was resolved during research.",
        ),
  );
  if (result.loadBearingPremises.length > 0) {
    content.push(
      paragraph("Load-bearing premises:"),
      bullets(
        result.loadBearingPremises.map((premise) => [
          bold(premise.premise),
          ` — ${premise.independentlyInvestigated ? "independently investigated" : "NOT independently investigated"}; ${premise.authority}`,
        ]),
      ),
    );
  }
  if (result.counterCaseSearch) {
    content.push(
      paragraph("Counter-case search: ", italic(result.counterCaseSearch)),
    );
  }

  content.push(
    heading(3, "VI. Conclusion"),
    paragraph(
      "Classify under ",
      bold(result.htsCode),
      ` — ${result.description} Duty: ${result.dutyRate.effective}.`,
    ),
  );
  if (result.recommendation) {
    content.push(
      paragraph(
        "Filing recommendation: file under ",
        bold(result.recommendation.filingCode),
        `; binding ruling ${result.recommendation.bindingRuling ? "recommended" : "not required"}; recovery: ${result.recommendation.recoveryStrategy}.`,
      ),
    );
  }

  return { type: "doc", content };
}
