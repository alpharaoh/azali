/**
 * Rationale memos for the review-queue shipments — the contemporaneous
 * record behind each AI recommendation, keyed by shipment reference.
 * Editable rich text (TipTap JSON), opened from the event's "View memo".
 */

import { bold, bullets, heading, italic, paragraph } from "./tiptap";

export const RATIONALE_MEMOS: Record<string, Record<string, unknown>> = {
  // Classification — AX5400 mesh router (TCL, Taiwan origin).
  "SHP-2214": {
    type: "doc",
    content: [
      heading(2, "Classification Rationale Memo — AX5400 Mesh Router"),
      paragraph(
        italic(
          "Prepared by Azali · SHP-2214, invoice BW-5540 line 3 · Confidence 0.87 · 3 alternates rejected",
        ),
      ),
      heading(3, "I. Facts"),
      paragraph(
        "Line 3 covers 2,400 two-packs of the AX5400 tri-band Wi-Fi 6 mesh router (model RBK762), $128,000, origin Taiwan. Each retail pack contains one router and one satellite unit, put up together for retail sale.",
      ),
      heading(3, "II. Analysis"),
      paragraph(
        "Heading 8517 covers machines for the reception, conversion, and transmission of data. The article's sole function is wireless data transmission — GRI 1 places it in 8517. Within the heading:",
      ),
      bullets([
        [
          bold("8517.62"),
          " — machines for the reception, conversion and transmission of voice/data: describes the router exactly.",
        ],
        [
          bold("GRI 3(b) set question"),
          " — router + satellite are a retail set; the router gives the set its essential character. This caps confidence at 0.87 and is the reason for broker review.",
        ],
      ]),
      heading(3, "III. Alternatives considered and rejected"),
      bullets([
        [
          bold("8517.69.0000 (0.11)"),
          " — the residual \u201cother\u201d provision. Rejected on relative specificity: 8517.62's description covers the article exactly, and NY N324089 placed the identical router-plus-satellite configuration under .62. Retains 0.11 only for the outside chance the set analysis reads the satellite as the dominant component.",
        ],
        [
          bold("8471.80.1000 (0.06)"),
          " — ADP network units. Rejected by operation of law: Chapter 84, Note 6(D) excludes machines performing a communication function from heading 8471. Residual weight reflects legacy hub rulings that predate the note.",
        ],
        [
          bold("8517.71.0000 (0.03)"),
          " — antennas and parts. Rejected under GRI 1: the AX5400 is complete, retail-packaged apparatus, not a part. Near-zero weight kept only for the mesh satellite viewed in isolation.",
        ],
      ]),
      heading(3, "IV. Precedent & measures"),
      paragraph(
        bold("NY N324089"),
        " classified a comparable consumer mesh system (router + satellites) in 8517.62.00, free of duty. Origin Taiwan — no Section 301 exposure. Duty: Free across every candidate; the call is classification risk only.",
      ),
      heading(3, "V. Conclusion"),
      paragraph(
        "Classify under ",
        bold("8517.62.0090"),
        ", free of duty, on the strength of N324089 and the catalog precedent for the companion EX-3 extender.",
      ),
    ],
  },

  // Classification — SA-2241 blazer chief-weight call (H&M).
  "SHP-2216": {
    type: "doc",
    content: [
      heading(2, "Classification Rationale Memo — Style SA-2241 Blazer"),
      paragraph(
        italic(
          "Prepared by Azali · SHP-2216 · Confidence 0.82 · Alternate: 6204.33.5010 (0.28)",
        ),
      ),
      heading(3, "I. Facts"),
      paragraph(
        "3,800 units of the SA-2241 women's woven blazer. Shell: ",
        bold("55% wool / 45% polyester"),
        " per the approved spec sheet; mill certificate laboratory result 55.2% wool by weight; lining 100% polyester (lining does not govern).",
      ),
      heading(3, "II. Analysis"),
      paragraph(
        "Chapter 62, Subheading Note 2: garments are classified by the chief-weight fibre of the outer shell. Wool at 55% is chief weight → ",
        bold("6204.31"),
        " (of wool) at 17.5%, not 6204.33 (of synthetic fibres) at 26.9%. The 10-point margin above 50% leaves headroom against lab variance; the mill certificate corroborates.",
      ),
      heading(3, "III. Alternative considered and rejected"),
      paragraph(
        bold("6204.33.5010 (0.28)"),
        " — of synthetic fibres, 26.9%. Applies only if polyester were chief weight of the shell. Rejected on the evidence: the approved spec states 55/45 wool-poly and the mill certificate's laboratory result is 55.2% wool by ISO 1833 — the lab would need to err by more than five points. The alternate keeps meaningful weight (0.28) because the blend sits near the 50% line: a composition change on the final invoice would flip the code and add ~$6,035 duty. The client's written confirmation and the certificate are on file against exactly that risk.",
      ),
      heading(3, "IV. Conclusion"),
      paragraph(
        "Classify under ",
        bold("6204.31.20"),
        " (17.5%), per ",
        bold("HQ 960950"),
        " (55/45 wool-poly blazer → 6204.31).",
      ),
    ],
  },

  // Classification — TR-9 trail runner under the new 6404 split (Nike).
  "SHP-2230": {
    type: "doc",
    content: [
      heading(2, "Classification Rationale Memo — TR-9 Trail Runner"),
      paragraph(
        italic(
          "Prepared by Azali · SHP-2230 · Triggered by the mid-year 6404 statistical split · Confidence 0.91",
        ),
      ),
      heading(3, "I. Trigger"),
      paragraph(
        "The mid-year HTS revision subdivided 6404.11.90 by upper material. 132 Summit-catalog SKUs were affected; 129 reassigned automatically on unambiguous specs. TR-9 needed a manual call because its upper mixes textile mesh and synthetic overlays.",
      ),
      heading(3, "II. Analysis"),
      bullets([
        [
          bold("Upper composition"),
          " — 78% textile mesh / 22% synthetic overlays by external surface area: textile controls.",
        ],
        [
          bold("Value break"),
          " — $13.58/pair, over the $12 statistical line.",
        ],
        [
          bold("Duty"),
          " — 20% under both the old and new ten-digit lines: statistical change only, $0 duty impact.",
        ],
      ]),
      heading(3, "III. Conclusion"),
      paragraph(
        "Reassign to ",
        bold("6404.11.90"),
        " (new statistical suffix — athletic footwear, textile upper, over $12/pair). Codes-only correction; refile before the Savannah entry.",
      ),
    ],
  },

  // Valuation — related-party price (Bosch).
  "SHP-2225": {
    type: "doc",
    content: [
      heading(2, "Valuation Rationale Memo — Part RW-4471"),
      paragraph(
        italic(
          "Prepared by Azali · SHP-2225, invoice INV-4471 · Confidence 0.71 · Related-party transaction",
        ),
      ),
      heading(3, "I. Facts"),
      paragraph(
        "11,000 sensor housings (part RW-4471) purchased from the seller's parent at ",
        bold("$8.40/unit"),
        " — 18% below the trailing 12-month unrelated-seller average of $10.25/unit for the same part.",
      ),
      heading(3, "II. Analysis (19 USC §1401a(b)(2)(B))"),
      paragraph(
        "Transaction value between related persons is acceptable where the circumstances of sale show the relationship did not influence the price:",
      ),
      bullets([
        [
          bold("Transfer pricing study"),
          " — TNMM method; the intercompany margin sits inside the documented arm's-length range.",
        ],
        [
          bold("Price consistency"),
          " — prior related-party entries ran $8.35–8.55/unit and were accepted at liquidation without question.",
        ],
        [
          bold("Volume explanation"),
          " — the parent supplies at contract volume pricing; unrelated sellers quote spot.",
        ],
      ]),
      heading(3, "III. Conclusion"),
      paragraph(
        "Accept ",
        bold("transaction value"),
        " under the circumstances-of-sale test. The 18% gap is explained and documented; broker sign-off requested given §1592 exposure reaches prior entries at the same price.",
      ),
    ],
  },

  // PGA — FDA device determination (L'Oréal LED mask).
  "SHP-2220": {
    type: "doc",
    content: [
      heading(2, "PGA Rationale Memo — JB-LED-01 LED Facial Mask"),
      paragraph(
        italic(
          "Prepared by Azali · SHP-2220 · Confidence 0.74 · Question: FDA device flag required?",
        ),
      ),
      heading(3, "I. Facts"),
      paragraph(
        "6,500 units of an LED facial mask (red & blue light modes). The product listing claims ",
        italic("“red & blue light for skin rejuvenation”"),
        "; the retail box carries wellness language only, per the packaging artwork supplied by the client.",
      ),
      heading(3, "II. Analysis"),
      bullets([
        [
          bold("21 CFR §878.4810"),
          " — light-based devices intended for medical purposes are Class II devices requiring premarket notification.",
        ],
        [
          bold("General Wellness Guidance"),
          " — claims limited to general wellness with low safety risk fall outside device regulation.",
        ],
        [
          bold("The listing language"),
          " — “skin rejuvenation” with red/blue therapy modes reads as a structure/function claim; blue-light acne positioning in the marketplace pushes toward intended medical use.",
        ],
      ]),
      heading(3, "III. Conclusion"),
      paragraph(
        "The wellness exemption is ",
        bold("likely unavailable"),
        " on the current claims. Recommend filing with the ",
        bold("FDA DEV flag"),
        " for this entry, and flag the artwork/claims cleanup for future POs if the client wants the exemption.",
      ),
    ],
  },
};
