import { bold, bullets, heading, italic, paragraph } from "@/lib/tiptap";
import type { PgaDetermination } from "./schema";

/** "required" → "filing required"; "disclaim" → "disclaimed (code B)". */
function determinationLabel(determination: PgaDetermination): string {
  switch (determination.determination) {
    case "required":
      return "filing required";
    case "disclaim":
      return determination.disclaimCode
        ? `disclaimed (code ${determination.disclaimCode})`
        : "disclaimed";
    default:
      return "not applicable";
  }
}

export interface PgaMemoLine {
  lineNumber: number;
  description: string;
  htsCode: string;
  originCountry: string;
  determinations: PgaDetermination[];
  jurisdictionSweep: string | null;
  clarifyingQuestions: string[];
  summary: string | null;
}

/**
 * The contemporaneous screening memo — the reasonable-care record behind one
 * line's PGA determinations, in the same broker-memo structure as the
 * classification rationale memo. Deterministic render of the structured
 * screening result: the memo and anything filed downstream are two views of
 * the same rows and can never disagree.
 */
export function buildPgaScreeningMemo(
  line: PgaMemoLine,
  shipment: { reference: string; clientName: string | null },
): Record<string, unknown> {
  const inPlay = line.determinations.filter(
    (determination) => determination.determination !== "not_applicable",
  );
  const posture =
    inPlay.length === 0
      ? "no agency requirements"
      : `${inPlay.length} agenc${inPlay.length === 1 ? "y" : "ies"} in play`;

  const content: Array<Record<string, unknown>> = [
    heading(
      2,
      `PGA Screening Memo — ${shipment.reference} · Line ${line.lineNumber}`,
    ),
    paragraph(
      italic(
        `Prepared by Azali · ${shipment.clientName ?? "Importer"} · HTS ${line.htsCode} · Origin ${line.originCountry} · ${posture}`,
      ),
    ),
    heading(3, "I. Facts"),
    paragraph(
      `${line.description}. Classified under ${line.htsCode}; country of origin ${line.originCountry}.`,
    ),
  ];
  if (line.summary) {
    content.push(paragraph(line.summary));
  }

  content.push(heading(3, "II. Agency determinations"));
  if (line.determinations.length === 0) {
    content.push(
      paragraph(
        "No agency flags attach to this tariff line, and the jurisdiction screen found no agency with a plausible claim on this product.",
      ),
    );
  }
  for (const determination of line.determinations) {
    const flagNote = determination.flagCode
      ? `flag ${determination.flagCode}`
      : "identified by jurisdictional analysis";
    content.push(
      paragraph(
        bold(
          `${determination.agencyName || determination.agencyCode} (${flagNote}) — ${determinationLabel(determination)}.`,
        ),
        ` ${determination.rationale}`,
      ),
    );
    if (
      determination.determination === "required" &&
      determination.dataElements.length > 0
    ) {
      content.push(
        bullets(
          determination.dataElements.map((element) => [
            bold(element.name),
            element.present
              ? ` — on file${element.sourceDocument ? ` (${element.sourceDocument})` : ""}`
              : " — MISSING; must be obtained before filing",
          ]),
        ),
      );
    }
  }

  if (line.jurisdictionSweep) {
    content.push(
      heading(3, "III. Jurisdiction sweep"),
      paragraph(line.jurisdictionSweep),
    );
  }

  // Authorities across all determinations, deduped by reference.
  const citations = [
    ...new Map(
      line.determinations
        .flatMap((determination) => determination.citations)
        .map((citation) => [citation.ref, citation]),
    ).values(),
  ];
  if (citations.length > 0) {
    content.push(
      heading(3, "IV. Authorities"),
      bullets(
        citations.map((citation) => [
          bold(citation.ref),
          ` — "${citation.quote}"`,
        ]),
      ),
    );
  }

  content.push(heading(3, "V. Open items"));
  content.push(
    line.clarifyingQuestions.length > 0
      ? bullets(line.clarifyingQuestions.map((question) => [question]))
      : paragraph(
          "None — every determination was made on the documents provided.",
        ),
  );

  const filings = inPlay.filter(
    (determination) => determination.determination === "required",
  );
  const disclaims = inPlay.filter(
    (determination) => determination.determination === "disclaim",
  );
  const conclusion = [
    filings.length > 0
      ? `File: ${filings
          .map(
            (determination) =>
              determination.agencyCode +
              (determination.flagCode ? ` (${determination.flagCode})` : ""),
          )
          .join(", ")}.`
      : null,
    disclaims.length > 0
      ? `Disclaim: ${disclaims
          .map(
            (determination) =>
              `${determination.agencyCode}${determination.disclaimCode ? ` (code ${determination.disclaimCode})` : ""}`,
          )
          .join(", ")}.`
      : null,
    filings.length === 0 && disclaims.length === 0
      ? "No PGA filings or disclaims are required for this line."
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  content.push(heading(3, "VI. Conclusion"), paragraph(conclusion));

  return { type: "doc", content };
}
