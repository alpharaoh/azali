/**
 * The agent-drafted CF-28 response letter for ENT-3979 (TrailGlow 3-in-1),
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
      "Entry No. ENT-3979 · TrailGlow 3-in-1 Portable Bluetooth Speaker with LED Lantern and Power Bank (SKU YT-CL-450)",
    ),
    paragraph(
      "Dear Import Specialist: This responds to the Form 28 dated June 30, 2026, requesting the basis for classification of the above merchandise under subheading 8518.22.0000, HTSUS. The classification is correct, for the reasons and on the evidence set out below.",
    ),
    heading(3, "I. The Merchandise"),
    paragraph(
      "The TrailGlow 3-in-1 is a portable, battery-operated device combining ",
      bold("three functions"),
      " in a single cylindrical housing: a Bluetooth loudspeaker (two full-range drivers, 2 × 5W, mounted in the same enclosure), a dimmable 350-lumen LED lantern ring, and a 4,400 mAh battery with a single USB-A output for charging external devices (Exhibit A: specification sheet; Exhibit B: photographs).",
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
      "The article is a composite machine. Note 3 to Section XVI, HTSUS, directs that it be classified as the machine performing its ",
      bold("principal function"),
      ". Every measure CBP customarily examines points to sound reproduction:",
    ),
    bullets([
      [
        bold("Component cost"),
        " — the audio subsystem accounts for ≈55%, more than the lighting and power subsystems combined.",
      ],
      [
        bold("Design emphasis"),
        " — dual drivers in a tuned enclosure with a dedicated amplifier; the LED ring and single 5V/1A port are commodity conveniences dimensioned to the speaker's power draw.",
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
      ", classifying a “camping lantern with speaker feature” in subheading 8513.10, is distinguishable on its facts: that device was lighting-dominant (800 lumens; 3-watt monaural speaker). The present article is the commercial inverse (10W stereo audio; 350-lumen secondary light), and its cost composition, design emphasis, and marketing all run opposite.",
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
      "Respectfully submitted, [Broker Name], Licensed Customs Broker — on behalf of YETI (Importer of Record).",
    ),
    paragraph(
      italic(
        "Exhibits: A — Specification sheet · B — Photographs (6) · C — Component cost breakdown (confidential treatment requested, 19 C.F.R. §177.2(b)(7)) · D — Retail packaging · E — Classification rationale memo",
      ),
    ),
  ],
};
