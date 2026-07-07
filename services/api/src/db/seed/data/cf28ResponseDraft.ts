/**
 * The agent-drafted CF-28 response letter for ENT-3979 (LUX-SP210),
 * stored as TipTap JSONContent so the broker can edit it in the rich text
 * editor. Plain objects only — no tiptap dependency on the API side.
 */

interface InlineNode {
  type: "text";
  text: string;
  marks?: Array<{ type: string }>;
}

const text = (value: string): InlineNode => ({ type: "text", text: value });

const bold = (value: string): InlineNode => ({
  type: "text",
  text: value,
  marks: [{ type: "bold" }],
});

const italic = (value: string): InlineNode => ({
  type: "text",
  text: value,
  marks: [{ type: "italic" }],
});

const heading = (level: number, value: string) => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});

const paragraph = (...children: Array<InlineNode | string>) => ({
  type: "paragraph",
  content: children.map((child) =>
    typeof child === "string" ? text(child) : child,
  ),
});

const bullets = (items: Array<Array<InlineNode | string>>) => ({
  type: "bulletList",
  content: items.map((item) => ({
    type: "listItem",
    content: [paragraph(...item)],
  })),
});

export const CF28_RESPONSE_DRAFT: Record<string, unknown> = {
  type: "doc",
  content: [
    heading(2, "Response to CBP Form 28 — Request for Information"),
    paragraph(
      italic(
        "Via ACE DIS · Port Director, U.S. Customs and Border Protection, Port of New York/Newark (1001)",
      ),
    ),
    paragraph(
      bold("RE: "),
      "Entry No. ENT-3979 · LUX-SP210 Portable Bluetooth Speaker with LED Lamp Ring (Invoice AZ-INV-20259-4471)",
    ),
    paragraph(
      "Dear Import Specialist: This responds to the Form 28 dated July 4, 2026 (Import Specialist D. Okafor, NIS Team 733), requesting the basis for classification of the above merchandise under subheading 8518.22.0000, HTSUS. The classification is correct, for the reasons and on the evidence set out below.",
    ),
    heading(3, "I. The Merchandise"),
    paragraph(
      "The LUX-SP210 is a portable, battery-operated device combining ",
      bold("three functions"),
      " in a single cylindrical housing: a Bluetooth loudspeaker (full-range driver in a tuned aluminum enclosure), a dimmable LED lamp ring with frosted diffuser, and a 5,000 mAh battery charged via USB-C (Exhibit A: specification sheet; Exhibit B: photographs).",
    ),
    paragraph(
      "Component cost composition (Exhibit C): audio subsystem ≈ ",
      bold("55%"),
      "; battery and power management ≈ 25%; LED lighting ≈ 20%. The retail box header reads ",
      italic("“Portable Bluetooth Speaker”"),
      " (Exhibit D), with the lantern and charging functions presented as secondary features.",
    ),
    heading(3, "II. Classification Analysis"),
    paragraph(
      "The Form 28 frames the question under GRI 3(b) (essential character). Because both components are machines of Section XVI, Note 3 to Section XVI governs and directs classification by ",
      bold("principal function"),
      " — though the analysis below satisfies either frame. Every measure CBP customarily examines points to sound reproduction:",
    ),
    bullets([
      [
        bold("Component cost"),
        " — the audio subsystem accounts for ≈55%, more than the lighting and power subsystems combined.",
      ],
      [
        bold("Design emphasis"),
        " — a tuned aluminum acoustic enclosure with a dedicated amplifier and Bluetooth module; the LED ring and diffuser are commodity conveniences.",
      ],
      [
        bold("Commercial identity"),
        " — the article is named, packaged, and merchandised as a speaker (Exhibits D–E).",
      ],
      [
        bold("Consumer expectation"),
        " — it competes in the portable-speaker market; the light and charging features replace items the consumer would otherwise carry, but neither would motivate the purchase.",
      ],
      [
        bold("Runtime"),
        " — the manufacturer rates the battery primarily in audio-playback hours (Exhibit A).",
      ],
    ]),
    paragraph(
      "In the alternative, were no principal function determinable, GRI 3(c) resolves classification to heading 8518 as the heading occurring last in numerical order among headings 8507, 8513, and 8518 meriting equal consideration.",
    ),
    heading(3, "III. Precedent"),
    paragraph(
      bold("NY N327431"),
      " classified a substantially similar Bluetooth speaker incorporating an LED lantern function in subheading 8518.22 on principal-function grounds. The present article parallels it in structure and commercial presentation, adding only a pass-through USB port that does not alter the analysis.",
    ),
    paragraph(
      bold("NY N305672"),
      ", classifying a “camping lantern with speaker feature” in subheading 8513.10, is distinguishable on its facts: that device was lighting-dominant (800 lumens; 3-watt monaural speaker). The present article's cost composition, design emphasis, and marketing all run opposite to that lighting-dominant configuration.",
    ),
    heading(3, "IV. Entry History and Reasonable Care"),
    paragraph(
      "Nine prior entries of this SKU under 8518.22.0000 have liquidated as entered, with no prior CBP action. The classification rests on a contemporaneous GRI analysis prepared at first entry (Exhibit E), reflecting the importer's exercise of reasonable care.",
    ),
    heading(3, "V. Conclusion"),
    paragraph(
      "The requested information is enclosed as Exhibits A–E. For the foregoing reasons, no rate advance is warranted and the covered entries should liquidate as entered. A physical sample is available upon request, and we welcome a call to discuss any remaining question.",
    ),
    paragraph(
      "Respectfully submitted, [Broker Name], Licensed Customs Broker — on behalf of the Importer of Record.",
    ),
    paragraph(
      italic(
        "Exhibits: A — Specification sheet · B — Photographs (6) · C — Component cost breakdown (confidential treatment requested, 19 C.F.R. §177.2(b)(7)) · D — Retail packaging · E — Classification rationale memo",
      ),
    ),
  ],
};
