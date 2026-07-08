/**
 * The agent-drafted CF-28 response letter for ENT-3979 (LUX-SP210),
 * stored as TipTap JSONContent so the broker can edit it in the rich text
 * editor. Plain objects only — no tiptap dependency on the API side.
 */

import { bold, bullets, heading, italic, paragraph } from "./tiptap";

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
      "Entry No. ENT-3979 · LUX-SP210 Portable Bluetooth Speaker Lamp (Invoice AZ-INV-20259-4471)",
    ),
    paragraph(
      "Dear Import Specialist: This responds to the Form 28 dated July 4, 2026 (Import Specialist D. Okafor, NIS Team 733), requesting the basis for classification of the above merchandise under subheading 8518.22.0000, HTSUS. Having re-examined the entry file — including the classification rationale memorandum prepared at the time of entry (Exhibit E) — the importer ",
      bold(
        "agrees that the merchandise is properly classified under subheading 8513.10.40, HTSUS",
      ),
      ", and submits this response to correct the covered entries.",
    ),
    heading(3, "I. The Merchandise"),
    paragraph(
      "The LUX-SP210 is a composite device: a dimmable LED lamp ring with frosted diffuser (2700 K, CRI ≥ 80), a modest 3W monaural Bluetooth speaker, and a 5,000 mAh battery (Exhibit A: specification sheet; Exhibit B: photographs). The supplier's approved specification states the product function as ",
      italic(
        "“portable rechargeable table lamp with integrated Bluetooth loudspeaker,”",
      ),
      " and the commercial invoice describes the article lamp-first.",
    ),
    heading(3, "II. Classification Analysis"),
    paragraph(
      "The Form 28 asks which component predominates. Under Section XVI, Note 3 (and equally under GRI 3(b)), the analysis prepared at entry concluded the ",
      bold("principal function is illumination"),
      ":",
    ),
    bullets([
      [
        bold("Holding out"),
        " — the supplier's specification and invoice both describe the article as a lamp; the product name is “Speaker Lamp.”",
      ],
      [
        bold("Engineering completeness"),
        " — the lighting system is fully realized (dimmable ring, diffuser, warm CCT, high CRI) while the audio is a single 3W mono driver.",
      ],
      [
        bold("Runtime allocation"),
        " — rated ≥ 12 hours as a light against ≥ 8 hours as a speaker.",
      ],
    ]),
    paragraph(
      bold("NY N305672"),
      " (a lighting-dominant lantern with speaker feature, classified in 8513.10) is the controlling analog; ",
      bold("NY N327431"),
      " (an audio-dominant 10W stereo device in 8518.22) is distinguishable on its facts.",
    ),
    heading(3, "III. The Entry as Filed"),
    paragraph(
      "The entry was transmitted under 8518.22.0000 pursuant to a documented broker election that departed from the memorandum's recommendation; the election and the memorandum's scrutiny flag were both recorded in the entry file at the time (Exhibit E). The importer does not defend that election here.",
    ),
    heading(3, "IV. Corrective Action"),
    paragraph(
      "The importer agrees to reclassification of the covered entries to 8513.10.40 (3.5% + Section 301 List 4A) and tenders the resulting duty difference — approximately ",
      bold("$1,700 on this entry and ~$19,000 across the 11 open entries"),
      " identified in the Form 28. Corrected summaries or post-summary corrections will be filed as the port directs.",
    ),
    paragraph(
      "Given the contemporaneous rationale memorandum, the documented analysis at entry, and this prompt correction upon inquiry, the importer respectfully submits that its conduct reflects ",
      bold("reasonable care"),
      " and requests that no penalty action be initiated (19 U.S.C. §1592(c)(4); Mitigation Guidelines).",
    ),
    heading(3, "V. Conclusion"),
    paragraph(
      "The requested information is enclosed as Exhibits A–E. We welcome a call to coordinate the mechanics of correction and tender. A physical sample remains available upon request.",
    ),
    paragraph(
      "Respectfully submitted, [Broker Name], Licensed Customs Broker — on behalf of the Importer of Record.",
    ),
    paragraph(
      italic(
        "Exhibits: A — Specification sheet · B — Photographs (6) · C — Component cost breakdown (confidential treatment requested, 19 C.F.R. §177.2(b)(7)) · D — Retail packaging · E — Classification rationale memorandum (prepared at entry)",
      ),
    ),
  ],
};

/**
 * The classification rationale memo Azali wrote at first entry — recommending
 * 8513.10.40 (which the broker later overrode to 8518.22.0000).
 */
export const CLASSIFICATION_MEMO: Record<string, unknown> = {
  type: "doc",
  content: [
    heading(2, "Classification Rationale Memo — LUX-SP210"),
    paragraph(
      italic(
        "Prepared by Azali at entry · Entry ENT-3979 · Confidence 0.84 · Alternate considered: 8518.22.0000 (0.62)",
      ),
    ),
    heading(3, "I. Facts"),
    paragraph(
      "The LUX-SP210 is a composite device: a dimmable LED lamp ring with frosted diffuser (2700 K, CRI ≥ 80), a 3W monaural Bluetooth speaker, and a 5,000 mAh battery. The supplier's approved specification states the product function as ",
      italic("“portable rechargeable table lamp with integrated Bluetooth loudspeaker”"),
      ", and the commercial invoice describes the article lamp-first with HTS 8513.10.40 suggested.",
    ),
    heading(3, "II. Analysis"),
    paragraph(
      "Under Section XVI, Note 3, classification follows the ",
      bold("principal function"),
      ". The factors point to lighting:",
    ),
    bullets([
      [
        bold("Holding out"),
        " — the supplier's own spec sheet and invoice describe the article as a lamp; the product name is “Speaker Lamp.”",
      ],
      [
        bold("Engineering completeness"),
        " — the lighting system is fully realized (dimmable ring, diffuser, warm CCT, high CRI) while the audio is a modest 3W mono driver.",
      ],
      [
        bold("Runtime allocation"),
        " — rated ≥ 12 h as a light against ≥ 8 h as a speaker.",
      ],
    ]),
    paragraph(
      "Counter-considerations acknowledged: the BOM cost split favors audio (≈55%) and the retail box header reads “Portable Bluetooth Speaker.” Cost share alone is not dispositive where function, design completeness, and holding-out run the other way.",
    ),
    heading(3, "III. Precedent"),
    paragraph(
      bold("NY N305672"),
      " (camping lantern with speaker feature → 8513.10) is the closer analog. ",
      bold("NY N327431"),
      " (audio-dominant speaker/lantern → 8518.22) is distinguishable: that article carried 10W stereo drivers and speaker-led marketing.",
    ),
    heading(3, "IV. Conclusion"),
    paragraph(
      "Classify under ",
      bold("8513.10.40"),
      " (3.5% + Section 301 List 4A). Duty impact vs. the 8518.22.0000 alternate: approximately +$1,700 on this entry.",
    ),
    paragraph(
      italic(
        "Flag: if the entry is filed under 8518.22.0000 instead, document the basis carefully — the supplier's own descriptions will draw scrutiny to that code.",
      ),
    ),
  ],
};
