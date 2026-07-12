import { bold, bullets, heading, italic, paragraph } from "@/lib/tiptap";
import type { ClassificationResult } from "./schema";

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
        `Prepared by Azali · ${shipment.clientName ?? "Importer"} · Confidence ${result.confidence.toFixed(2)} · ${result.alternates.length} alternate${result.alternates.length === 1 ? "" : "s"} rejected`,
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

  content.push(
    heading(3, "V. Conclusion"),
    paragraph(
      "Classify under ",
      bold(result.htsCode),
      ` — ${result.description} Duty: ${result.dutyRate.effective}.`,
    ),
  );

  return { type: "doc", content };
}
