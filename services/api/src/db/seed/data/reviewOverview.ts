// Generated from apps/web/src/data/review-queue.ts — per-reference demo
// overview content (documents, activity events, alternates, comparison).
// Regenerate via the extraction script if the mock data changes.
// (ENT-3979 is hand-authored: the TrailGlow CF-28 case.)

import { CF28_RESPONSE_DRAFT, CLASSIFICATION_MEMO } from "./cf28ResponseDraft";
import { RATIONALE_MEMOS } from "./rationaleMemos";

export interface SeedDocumentLine {
  label: string;
  value: string;
  highlight?: boolean;
}

export type SeedDocument =
  | {
      kind: "pdf";
      name: string;
      meta: string;
      receivedHoursAgo: number;
      lines: SeedDocumentLine[];
      note?: string;
      /** Editable rich-text body (TipTap JSON) for agent-drafted documents. */
      draft?: Record<string, unknown>;
      /** Public path to the real PDF file — rendered side-by-side with the extraction. */
      src?: string;
      /** AI summary of the document, shown next to the extracted fields. */
      summary?: string;
    }
  | { kind: "email"; from: string; subject: string; body: string; meta: string; receivedHoursAgo: number }
  | { kind: "scan"; name: string; meta: string; receivedHoursAgo: number; src: string; extracted: SeedDocumentLine[]; note?: string };

export interface SeedActivityEvent {
  title: string;
  detail?: string;
  steps?: string[];
  occurredHoursAgo: number;
  icon: "ai" | "check" | "mail" | "user";
  status?: string;
  /** The event has a rationale memo behind it — renders a "View memo" action. */
  memo?: boolean;
}

export interface SeedCitation {
  kind: string;
  ref: string;
  quote: string;
  href?: string;
  documentName?: string;
}

export interface SeedOverview {
  citations: SeedCitation[];
  approveLabel: string;
  canRequestInfo: boolean;
  documents: SeedDocument[];
  events: SeedActivityEvent[];
  alternates: Array<{
    value: string;
    detail: string;
    confidence: number;
    /** Why this candidate scored what it did — and why it wasn't chosen. */
    reason?: string;
  }> | null;
  comparison: { docA: string; docB: string; rows: Array<{ label: string; a: string; b: string }> } | null;
}

export const REVIEW_OVERVIEW: Record<string, SeedOverview> = {
  "ENT-4471": {
    documents: [
      {
        kind: "email",
        from: "bookings@pacificrimimports.com",
        subject: "ENT-4471 — full doc set for LA/Long Beach, vessel due Thursday",
        body: "Docs attached for the Shanghai consolidation: commercial invoice PRI-3301, packing list, and the COSCO bill of lading. Same product mix as the June shipment. Please file pre-arrival — the DC is expecting delivery Friday.",
        meta: "Email · 3 attachments",
        receivedHoursAgo: 26,
      },
      {
        kind: "pdf",
        name: "Commercial Invoice PRI-3301",
        meta: "Shenzhen Kaida Trading · 6 pages",
        receivedHoursAgo: 26,
        summary:
          "Twenty-four line items from Shenzhen Kaida Trading totaling $186,400 FOB Shanghai — housewares across Chapters 85, 94, and 39. Every line matched a classification the team previously approved; the invoice, packing list, and bill of lading agree on all 72 compared fields.",
        lines: [
          { label: "Invoice", value: "PRI-3301 · Net 45" },
          { label: "Seller", value: "Shenzhen Kaida Trading Co., Ltd." },
          { label: "Buyer", value: "Pacific Rim Imports · IOR 36-4821997" },
          { label: "Terms", value: "FOB Shanghai (Incoterms 2020)" },
          { highlight: true, label: "Lines", value: "24 line items · Ch. 85 (14) · Ch. 94 (7) · Ch. 39 (3)" },
          { label: "Largest line", value: "Smart kettle SK-8 · 4,100 pcs @ $16.40" },
          { highlight: true, label: "Total invoice value", value: "USD 186,400.00" },
        ],
      },
      {
        kind: "pdf",
        name: "Packing List — PRI-3301",
        meta: "Shenzhen Kaida Trading · 3 pages",
        receivedHoursAgo: 26,
        lines: [
          { label: "Reference", value: "PRI-3301 · PO-77841" },
          { highlight: true, label: "Totals", value: "480 cartons · 18,340 units · G.W. 6,480 kg" },
          { label: "Container", value: "1 × 40' HC · floor-loaded" },
          { label: "Marks", value: "PACIFIC RIM / LA · C/NO 1-480 · MADE IN CHINA" },
        ],
      },
      {
        kind: "pdf",
        name: "Bill of Lading — COSU7719402113",
        meta: "COSCO Shipping Lines · 1 page",
        receivedHoursAgo: 25,
        lines: [
          { label: "B/L", value: "COSU7719402113 · SCAC COSU" },
          { highlight: true, label: "Vessel", value: "COSCO Harmony 112E · Shanghai → LA/Long Beach" },
          { label: "Container", value: "CSNU-7719402 · seal SL-9917740" },
          { label: "Cargo", value: "480 cartons · 6,480 kg gross" },
          { label: "Consignee", value: "Pacific Rim Imports, Los Angeles CA" },
        ],
      },
      {
        kind: "pdf",
        name: "Entry Summary Draft",
        meta: "CBP 7501 draft · 4 pages",
        receivedHoursAgo: 1,
        summary:
          "Draft 7501 ready to transmit: 24 lines, $186,400 declared, estimated duty $12,430 including the Section 301 List 4A stack on 22 China-origin lines. AD/CVD and PGA screens are clean. Every classification matched approved catalog entries — nothing new to decide, only the licensed sign-off.",
        lines: [
          { label: "Entry no.", value: "AZL-2026-4471 · Type 01" },
          { label: "Importer of record", value: "Pacific Rim Imports · 36-4821997" },
          { label: "Lines", value: "24 · all catalog-matched" },
          { label: "Declared value", value: "$186,400" },
          { highlight: true, label: "Estimated duty", value: "$12,430 (effective 6.7%)" },
          { label: "Ch. 99 measures", value: "301 List 4A · 7.5% (22 lines)" },
          { label: "AD/CVD · PGA flags", value: "None" },
        ],
      },
    ],
    events: [
      {
        title: "Entry documents extracted",
        detail:
          "Invoice, packing list, and bill of lading parsed — 118 fields, lowest confidence 0.94, cross-confirmed against the packing list.",
        icon: "ai",
        occurredHoursAgo: 22,
        steps: [
          "24 line items · Σ line values $186,400.00 — matches the printed total exactly",
          "Invoice ↔ packing list ↔ B/L: 72 field comparisons, 0 conflicts",
        ],
      },
      {
        title: "Classified all 24 lines from the catalog",
        detail:
          "22 exact SKU matches, 2 by description similarity ≥ 0.97 — no new classification decisions required. Codes re-validated against the current HTS.",
        icon: "ai",
        occurredHoursAgo: 20,
      },
      {
        title: "Duty computed and entry assembled",
        detail:
          "Duty $12,430 across Ch. 85/94/39 plus the Section 301 List 4A stack; AD/CVD and PGA screens clean. Draft 7501 attached above.",
        icon: "ai",
        occurredHoursAgo: 2,
        status: "current",
        steps: [
          "Ch. 85: $1,890 · Ch. 94: $2,387 · Ch. 39: $1,214 · 301 List 4A: $6,939",
          "Vessel ETA ≈ 14 h — pre-arrival filing secures release on arrival",
        ],
      },
      {
        title: "Queued for licensed sign-off",
        icon: "check",
        occurredHoursAgo: 0.5,
      },
    ],
    "alternates": null,
    "comparison": null,
    "citations": [
      {
        "kind": "catalog",
        "quote": "All 24 lines matched classifications previously approved by your team.",
        "ref": "Classification Engine · 24 entries"
      },
      {
        "href": "https://www.ecfr.gov/current/title-19/section-142.2",
        "kind": "regulation",
        "quote": "Entry documentation must be filed within 15 calendar days of arrival; filing before arrival avoids storage charges.",
        "ref": "19 CFR §142.2"
      },
      {
        "kind": "evidence",
        "quote": "Invoice, packing list, and bill of lading agree on quantity, weight, consignee, and value — 72 of 72 field comparisons, Σ line values $186,400.00.",
        "documentName": "Commercial Invoice PRI-3301",
        "ref": "Docs · PRI-3301 / PL / B-L"
      },
      {
        "href": "https://hts.usitc.gov/",
        "kind": "regulation",
        "quote": "Column 1 general rates for the declared subheadings: Ch. 85 0–2.6% · Ch. 94 3.9% · Ch. 39 various.",
        "ref": "HTSUS Column 1 rates"
      },
      {
        "href": "https://access.trade.gov/adcvd",
        "kind": "regulation",
        "quote": "No active anti-dumping or countervailing duty orders for the declared HTS/origin pairs.",
        "ref": "AD/CVD case registry"
      },
      {
        "href": "https://hts.usitc.gov/search?query=9903.88.15",
        "kind": "regulation",
        "quote": "Articles the product of China, as provided for in U.S. note 20(r) to this subchapter — additional duty of 7.5% (9903.88.15).",
        "ref": "USTR Section 301 · List 4A"
      },
      {
        "kind": "evidence",
        "quote": "Trailing 12-month effective duty rate for this product mix: 6.5%.",
        "ref": "Entry history · Pacific Rim"
      }
    ],
    "approveLabel": "Approve & File",
    "canRequestInfo": false
  },
  "SHP-2209": {
    documents: [
      {
        kind: "email",
        from: "logistics@nestleusa.com",
        subject: "SHP-2209 — docs for the Rotterdam sailing, NY/NJ arrival",
        body: "Hi team — attached invoice and packing list for the Rotterdam shipment on Maersk Essen. Please clear before the weekend if possible, we have a DC appointment Monday morning.",
        meta: "Email · 2 attachments",
        receivedHoursAgo: 4,
      },
      {
        kind: "pdf",
        name: "Commercial Invoice INV-88231",
        meta: "Nestlé Suisse S.A. · 2 pages",
        receivedHoursAgo: 3,
        summary:
          "Twelve line items of specialty food product totaling $45,780 by line-item sum — but the printed total on page 2 reads $48,250, a $2,470 discrepancy the document carries within itself. The packing list corroborates the line items, pointing to a typo in the printed total.",
        lines: [
          { label: "Invoice", value: "INV-88231 · 05 Jul" },
          { label: "Seller", value: "Nestlé Suisse S.A., Vevey" },
          { label: "Terms", value: "CIF New York (Incoterms 2020)" },
          { label: "Lines", value: "12 line items · specialty food product" },
          { label: "Largest line", value: "Line 4 · 1,800 cases @ $9.10" },
          { highlight: true, label: "Σ line items (1–12)", value: "USD 45,780.00" },
          { highlight: true, label: "Total (printed, p.2)", value: "USD 48,250.00 — disagrees by $2,470" },
          { label: "Currency", value: "USD" },
        ],
      },
      {
        kind: "pdf",
        name: "Packing List PL-88231",
        meta: "Nestlé Suisse S.A. · 2 pages",
        receivedHoursAgo: 3,
        lines: [
          { label: "Reference", value: "PL-88231 · matches INV-88231" },
          { highlight: true, label: "Corroboration", value: "Quantities and unit prices agree with lines 1–12 (24/24 fields)" },
          { label: "Totals", value: "310 cartons · 8,650 kg gross" },
          { label: "Container", value: "1 × 20' reefer · MRKU-8823144" },
        ],
      },
    ],
    events: [
      {
        title: "Entry documents extracted",
        detail:
          "Both pages parsed at confidence ≥ 0.96 — the printed total itself read cleanly, so this is not an OCR error.",
        icon: "ai",
        occurredHoursAgo: 2.5,
        steps: [
          "12 line items · 34 fields extracted",
          "Packing list PL-88231: 24 of 24 field comparisons agree with the line items",
        ],
      },
      {
        title: "AI flagged a totals mismatch",
        detail:
          "Printed total disagrees with the line-item sum by $2,470 — proposing the line-item sum with the packing list as support.",
        icon: "ai",
        occurredHoursAgo: 2,
        status: "warning",
        steps: [
          "Σ(12 line items) $45,780 ≠ printed total $48,250 (−5.1%)",
          "Ruled out freight add-ons, currency mix-up, and missing pages",
          "Declared @ $48,250 → duty $12,798 · @ $45,780 → $12,118 (Δ ≈ $680 overpaid)",
        ],
      },
    ],
    "alternates": null,
    "comparison": null,
    "citations": [
      {
        "href": "https://www.ecfr.gov/current/title-19/section-141.86",
        "kind": "regulation",
        "quote": "Each invoice shall set forth an accurate and itemized statement of the purchase price of each item.",
        "ref": "19 CFR §141.86(a)"
      },
      {
        "kind": "evidence",
        "quote": "Packing list quantities and unit prices agree with the 12 line items, not the printed total.",
        "documentName": "Packing List PL-88231",
        "ref": "Packing list PL-88231"
      },
      {
        "kind": "evidence",
        "quote": "Printed TOTAL (page 2): $48,250.00 · Σ line items 1–12: $45,780.00 — the document disagrees with itself.",
        "documentName": "Commercial Invoice INV-88231",
        "ref": "Invoice INV-88231"
      },
      {
        "kind": "evidence",
        "quote": "Please clear before the weekend if possible, we have a DC appointment Monday morning.",
        "ref": "Email · ops@harborfoods.com"
      }
    ],
    "approveLabel": "Approve Correction",
    "canRequestInfo": false
  },
  "SHP-2214": {
    documents: [
      {
        kind: "pdf",
        name: "Commercial Invoice BW-5540",
        meta: "Bluewave Electronics · 3 pages",
        receivedHoursAgo: 7,
        summary:
          "Three-line invoice totaling $149,000 FOB Kaohsiung, origin Taiwan. Lines 1 and 2 matched the catalog automatically; line 3 — 2,400 two-packs of the AX5400 tri-band mesh router at $128,000 — is the SKU needing the classification call. Taiwan origin means no Section 301 exposure.",
        lines: [
          { label: "Invoice", value: "BW-5540 · Net 30" },
          { label: "Seller", value: "Bluewave Electronics Co., Kaohsiung" },
          { label: "Terms", value: "FOB Kaohsiung (Incoterms 2020)" },
          { label: "Line 1", value: "USB-C cables (2m) · $6,200 — catalog match" },
          { label: "Line 2", value: "Mesh extender EX-3 · $14,800 — catalog match" },
          { highlight: true, label: "Line 3", value: "AX5400 tri-band mesh router, 2-pack (RBK762) · 2,400 packs · $128,000" },
          { highlight: true, label: "Country of origin", value: "Taiwan — outside the Section 301 lists" },
          { label: "Total invoice value", value: "USD 149,000.00" },
        ],
      },
      {
        kind: "pdf",
        name: "Datasheet — AX5400 (RBK762)",
        meta: "Manufacturer datasheet · 4 pages",
        receivedHoursAgo: 7,
        lines: [
          { label: "System", value: "Tri-band Wi-Fi 6 mesh · router + satellite per retail pack" },
          { highlight: true, label: "Function", value: "Wireless reception, conversion & transmission of data" },
          { label: "Throughput", value: "AX5400 · 5.4 Gbps aggregate" },
          { label: "Ports", value: "1 × WAN, 3 × LAN gigabit per unit" },
          { label: "Retail pack", value: "Router + satellite sold as a set" },
        ],
      },
      {
        kind: "pdf",
        name: "CROSS Ruling NY N324089",
        meta: "Reference · CBP rulings database",
        receivedHoursAgo: 7,
        lines: [
          { label: "Merchandise", value: "Mesh Wi-Fi system (router + satellites)" },
          { highlight: true, label: "Holding", value: "8517.62.0090 · free of duty" },
          { label: "Ruling date", value: "March 2022" },
          { label: "Relevance", value: "Closest precedent — same principal function, same set question" },
        ],
      },
      {
        kind: "pdf",
        name: "Classification Rationale Memo — AX5400",
        meta: "Generated by Azali · 2 pages",
        receivedHoursAgo: 6,
        lines: [
          { highlight: true, label: "Recommendation", value: "8517.62.0090 · confidence 0.87" },
          { label: "Alternate", value: "8517.69.0000 · confidence 0.11" },
          { label: "Why reviewed", value: "GRI 3(b) set question caps confidence below the 95% auto-file line" },
          { label: "Precedent", value: "NY N324089 · catalog match on the EX-3 extender" },
        ],
        draft: RATIONALE_MEMOS["SHP-2214"],
      },
    ],
    events: [
      {
        title: "Entry documents extracted",
        detail:
          "Invoice parsed; lines 1 and 2 matched approved catalog entries automatically — only line 3 needs a decision.",
        icon: "ai",
        occurredHoursAgo: 6.5,
        steps: [
          "Line 3: AX5400 tri-band mesh Wi-Fi 6 router, 2-pack · $128,000 · origin Taiwan",
          "Datasheet pulled from the manufacturer portal for the set analysis",
        ],
      },
      {
        title: "Classified 8517.62.0090 at 87% with rationale memo",
        detail:
          "Below the 95% auto-file threshold because of the GRI 3(b) set question — queued for review with the memo attached.",
        icon: "ai",
        memo: true,
        occurredHoursAgo: 6,
        status: "current",
        steps: [
          "CROSS query \u201cmesh wi-fi router system\u201d \u2192 14 rulings · top match NY N324089 (0.94)",
          "Catalog precedent: the companion EX-3 extender approved under the same code",
          "Rejected 8517.69 (posterior 0.11) · duty Free either way — classification risk only",
        ],
      },
    ],
    alternates: [
      {
        value: "8517.69.0000",
        detail: "Other apparatus for transmission or reception of data",
        confidence: 0.11,
        reason:
          "The residual \u201cother\u201d bucket. Loses to 8517.62's specific description under relative specificity, and NY N324089 addressed this exact router-plus-satellite configuration under .62 \u2014 the ruling would have to be wrong for this code to be right.",
      },
      {
        value: "8471.80.1000",
        detail: "Automatic data processing units \u2014 network hubs and similar",
        confidence: 0.06,
        reason:
          "Routers are excluded from ADP heading 8471 by Chapter 84, Note 6(D) \u2014 machines performing a communication function belong to 8517. Scored above zero only because legacy hub rulings predate the note.",
      },
      {
        value: "8517.71.0000",
        detail: "Aerials and antennas; parts suitable for use with 8517 apparatus",
        confidence: 0.03,
        reason:
          "A parts provision. The AX5400 is complete, retail-packaged apparatus \u2014 GRI 1 keeps finished machines out of parts headings.",
      },
    ],
    "comparison": null,
    "citations": [
      {
        "href": "https://rulings.cbp.gov/ruling/N324089",
        "kind": "ruling",
        "quote": "A mesh Wi-Fi system comprising a router and satellite units is classified under subheading 8517.62.00, free of duty.",
        "ref": "CROSS NY N324089"
      },
      {
        "href": "https://hts.usitc.gov/search?query=8517",
        "kind": "regulation",
        "quote": "Heading 8517 covers machines for the reception, conversion and transmission of voice, images or other data.",
        "ref": "HTSUS Heading 8517"
      },
      {
        "kind": "catalog",
        "quote": "Mesh extender EX-3 approved under 8517.62.0090 for Bluewave in March — same principal function.",
        "ref": "Catalog · BW-EXT-003"
      },
      {
        "kind": "evidence",
        "quote": "AX5400 tri-band wireless mesh Wi-Fi 6 router, 2-pack, model RBK762 — $128,000 · origin Taiwan.",
        "documentName": "Commercial Invoice BW-5540",
        "ref": "Invoice BW-5540 · line 3"
      },
      {
        "href": "https://hts.usitc.gov/",
        "kind": "regulation",
        "quote": "Goods put up in sets for retail sale shall be classified by the component which gives them their essential character.",
        "ref": "GRI 3(b)"
      },
      {
        "href": "https://hts.usitc.gov/search?query=9903.88",
        "kind": "regulation",
        "quote": "Section 301 additional duties apply to products of China — Taiwan-origin goods fall outside the lists.",
        "ref": "HTSUS Ch. 99, Subch. III"
      }
    ],
    "approveLabel": "Approve",
    "canRequestInfo": false
  },
  "SHP-2218": {
    "documents": [
      {
        kind: "email",
        from: "imports@caterpillar-logistics.com",
        subject: "SHP-2218 — scanned CBP forms for the vessel import",
        body: "Scans attached as requested — these are the two forms we have on file for the vessel transaction. Apologies for the quality, they came from the broker's archive. Let us know if anything is missing.",
        meta: "Email · 2 attachments",
        receivedHoursAgo: 5,
      },
      {
        "extracted": [
          {
            "label": "Form",
            "value": "CBP 1300 — Vessel Entrance/Clearance"
          },
          {
            "label": "Vessel",
            "value": "“Harmonie” · 49′4″ yacht · USA flag"
          },
          {
            "label": "Built",
            "value": "La Rochelle, France · 1996"
          },
          {
            "label": "Route",
            "value": "Simpson Bay, SX → Culebra, PR"
          },
          {
            "highlight": true,
            "label": "Box 3 date (handwritten)",
            "value": "01 MAY 2020"
          },
          {
            "highlight": true,
            "label": "CBP stamp",
            "value": "Cleared MAY 01 2022"
          }
        ],
        "kind": "scan",
        "meta": "Scan · 1 page",
        "name": "Vessel Entrance or Clearance Statement",
        "note": "The handwritten year contradicts the CBP stamp and the April 2022 voyage dates — almost certainly a pen slip for 2022.",
        "receivedHoursAgo": 4,
        "src": "/mock.jpeg"
      },
      {
        "extracted": [
          {
            "label": "Form",
            "value": "CBP 6059B — Customs Declaration"
          },
          {
            "highlight": true,
            "label": "Traveler",
            "value": "Armstrong, Nel A."
          },
          {
            "label": "Countries visited",
            "value": "Germany, Kuwait, Qatar, UK"
          },
          {
            "highlight": true,
            "label": "CBP stamp",
            "value": "March 2010"
          }
        ],
        "kind": "scan",
        "meta": "Scan · 1 page",
        "name": "Customs Declaration (6059B)",
        "note": "Different person, different trip, stamped 2010 — this doesn't belong to SHP-2218 and was likely misfiled by the client.",
        "receivedHoursAgo": 4,
        "src": "/mock2.jpeg"
      }
    ],
    "events": [
      {
        "detail": "Found a date discrepancy and one unrelated form.",
        "icon": "ai",
        "occurredHoursAgo": 3,
        "status": "warning",
        "steps": [
          "CBP 1300 matches SHP-2218: vessel “Harmonie”, Simpson Bay → Culebra",
          "1300's handwritten 2020 contradicted by CBP stamp + April 2022 voyage calls",
          "6059B is a 2010 traveler declaration for a different person → misfiled"
        ],
        "title": "AI compared the two scans"
      }
    ],
    "alternates": null,
    "comparison": {
      "docA": "Vessel Clearance (CBP 1300)",
      "docB": "Customs Declaration (6059B)",
      "rows": [
        {
          "a": "Vessel clearance statement",
          "b": "Traveler's personal declaration",
          "label": "Form type"
        },
        {
          "a": "Yacht “Harmonie” · Karen Smith",
          "b": "Traveler “Armstrong, Nel A.”",
          "label": "Party"
        },
        {
          "a": "Stamped May 1, 2022",
          "b": "Stamped March 2010",
          "label": "CBP stamp"
        },
        {
          "a": "Yes — supports the vessel import",
          "b": "No — unrelated transaction",
          "label": "Belongs to this entry"
        }
      ]
    },
    "citations": [
      {
        "href": "https://www.ecfr.gov/current/title-19/section-4.61",
        "kind": "regulation",
        "quote": "Vessel entrance and clearance statements are made on CBP Form 1300.",
        "ref": "19 CFR §4.61"
      },
      {
        "kind": "evidence",
        "quote": "The CBP stamp reads MAY 01 2022 and voyage particulars list April 2022 calls — contradicting the handwritten 2020.",
        "documentName": "Vessel Entrance or Clearance Statement",
        "ref": "Scan · CBP Form 1300"
      },
      {
        "kind": "evidence",
        "quote": "Vessel “Harmonie”, Simpson Bay → Culebra, agent Karen Smith — matches the CBP 1300 particulars line for line.",
        "ref": "Booking · SHP-2218"
      },
      {
        "kind": "evidence",
        "quote": "Traveler “Armstrong, Nel A.”, countries visited Germany/Kuwait/Qatar/UK, stamped March 2010 — no overlap with this transaction.",
        "documentName": "Customs Declaration (6059B)",
        "ref": "Scan · CBP Form 6059B"
      }
    ],
    "approveLabel": "Accept CBP 1300",
    "canRequestInfo": true
  },
  "SHP-2216": {
    documents: [
      {
        kind: "pdf",
        name: "Spec Sheet — Style SA-2241",
        meta: "Solstice Apparel · 2 pages",
        receivedHoursAgo: 12,
        summary:
          "Approved spec for the SA-2241 women's woven blazer: shell 55% wool / 45% polyester, fully lined in polyester. Chief weight decides the code — 55% wool puts it in 6204.31 at 17.5% instead of 6204.33 at 26.9%, a $6,035 swing on this shipment.",
        lines: [
          { label: "Style", value: "SA-2241 women's woven blazer" },
          { highlight: true, label: "Shell", value: "55% wool / 45% polyester" },
          { label: "Lining", value: "100% polyester (does not govern)" },
          { label: "Weight", value: "310 g/m² shell fabric" },
          { label: "Units", value: "3,800 · unit price $16.89" },
          { label: "Origin", value: "India · Nhava Sheva" },
        ],
      },
      {
        kind: "pdf",
        name: "Mill Certificate — Lot 44-A",
        meta: "Rajshree Mills · 1 page",
        receivedHoursAgo: 6,
        lines: [
          { label: "Certificate", value: "RM-2026-1188 · Lot 44-A" },
          { highlight: true, label: "Lab result", value: "55.2% wool / 44.8% polyester by weight (ISO 1833)" },
          { label: "Sampling", value: "3 specimens · shell fabric only" },
          { label: "Margin", value: "5.2 points above the 50% chief-weight line" },
        ],
      },
      {
        kind: "email",
        from: "merch@solsticeapparel.com",
        subject: "RE: SA-2241 fabric composition",
        body: "Confirming shell composition is 55/45 wool-poly per the mill certificate. The final commercial invoice will match the spec sheet — certificate attached for your records.",
        meta: "Email · 1 attachment",
        receivedHoursAgo: 6,
      },
      {
        kind: "pdf",
        name: "Classification Rationale Memo — SA-2241",
        meta: "Generated by Azali · 2 pages",
        receivedHoursAgo: 5,
        lines: [
          { highlight: true, label: "Recommendation", value: "6204.31.20 (wool chief weight) · confidence 0.82" },
          { label: "Alternate", value: "6204.33.5010 (synthetic) · confidence 0.28 · +$6,035 duty" },
          { label: "Legal frame", value: "Ch. 62, Subheading Note 2 — chief-weight fibre of the shell" },
          { label: "Precedent", value: "HQ 960950 — 55/45 wool-poly blazer → 6204.31" },
        ],
        draft: RATIONALE_MEMOS["SHP-2216"],
      },
    ],
    events: [
      {
        title: "Info request sent to Solstice",
        detail:
          "Asked the merch team to confirm SA-2241's fabric composition before locking the chief-weight call.",
        icon: "mail",
        occurredHoursAgo: 8,
      },
      {
        title: "Classified 6204.31.20 with rationale memo",
        detail:
          "Client confirmation and mill certificate agree with the spec — wool is chief weight at 55%, with lab corroboration at 55.2%.",
        icon: "ai",
        memo: true,
        occurredHoursAgo: 5,
        status: "current",
        steps: [
          "6204.31 (wool) 17.5% vs 6204.33 (synthetic) 26.9% — $6,035 at stake",
          "Mill certificate RM-2026-1188: 55.2% wool by ISO 1833",
          "HQ 960950 on point for the 55/45 configuration",
        ],
      },
    ],
    alternates: [
      {
        value: "6204.33.5010",
        detail: "Of synthetic fibres \u2014 26.9% duty",
        confidence: 0.28,
        reason:
          "Applies only if synthetics were chief weight. The mill certificate puts wool at 55.2% (ISO 1833) \u2014 the lab would need to be wrong by more than five points. Scored 0.28 because a 55/45 blend sits close enough to the line that a composition error on the final invoice could flip it.",
      },
    ],
    "comparison": null,
    "citations": [
      {
        "href": "https://hts.usitc.gov/search?query=6204",
        "kind": "regulation",
        "quote": "Garments are classified by the fabric of the outer shell; the chief-weight fibre of the shell governs.",
        "ref": "HTSUS Ch. 62, Subheading Note 2"
      },
      {
        "href": "https://rulings.cbp.gov/ruling/960950",
        "kind": "ruling",
        "quote": "A woven blazer of 55% wool and 45% polyester is classifiable under subheading 6204.31.",
        "ref": "CROSS HQ 960950"
      },
      {
        "kind": "evidence",
        "quote": "Shell: 55% wool / 45% polyester · Lining: 100% polyester · 3,800 units.",
        "documentName": "Spec Sheet — Style SA-2241",
        "ref": "Spec sheet SA-2241"
      },
      {
        "kind": "evidence",
        "quote": "Confirming shell composition is 55/45 wool-poly per the mill certificate. The final commercial invoice will match the spec sheet.",
        "ref": "Email · merch@solsticeapparel.com"
      },
      {
        "href": "https://hts.usitc.gov/search?query=6204.31",
        "kind": "regulation",
        "quote": "6204.31 (of wool): 17.5% ad valorem · 6204.33 (of synthetic fibres): 26.9% ad valorem.",
        "ref": "HTSUS 6204 rate lines"
      }
    ],
    "approveLabel": "Approve",
    "canRequestInfo": false
  },
  "SHP-2220": {
    documents: [
      {
        kind: "pdf",
        name: "Product Listing — JB-LED-01",
        meta: "Juniper Beauty Labs · 2 pages",
        receivedHoursAgo: 20,
        summary:
          "Marketplace listing for the JB-LED-01 LED facial mask: red & blue light modes marketed \u201cfor skin rejuvenation.\u201d The wellness-vs-medical-device line turns on exactly this claim language — blue-light positioning reads as a structure/function claim to FDA.",
        lines: [
          { label: "Product", value: "LED facial mask · SKU JB-LED-01" },
          { highlight: true, label: "Claims", value: "\u201cred & blue light for skin rejuvenation\u201d" },
          { label: "Modes", value: "Red (630nm) · blue (415nm) · 10-min auto cycle" },
          { label: "Power", value: "USB-C · 5V · 24 LEDs" },
          { label: "Units", value: "6,500 · unit price $5.98" },
        ],
      },
      {
        kind: "email",
        from: "ops@juniperbeautylabs.com",
        subject: "JB-LED-01 packaging artwork",
        body: "Packaging files attached — there are no medical claims on the retail box, only 'wellness' language. Let us know if the FDA prior notice is still needed; we can adjust artwork for the next PO if that helps.",
        meta: "Email · 1 attachment",
        receivedHoursAgo: 5,
      },
      {
        kind: "pdf",
        name: "Packaging Artwork — JB-LED-01",
        meta: "Retail box panels · 3 pages",
        receivedHoursAgo: 5,
        lines: [
          { label: "Front panel", value: "\u201cLED Beauty Mask — glow at home\u201d" },
          { highlight: true, label: "Back panel", value: "Wellness language only — no treatment or cure claims" },
          { label: "Inserts", value: "Usage guide references \u201cskin rejuvenation routine\u201d" },
          { label: "Markings", value: "CE · FCC · \u201cnot a medical device\u201d absent" },
        ],
      },
      {
        kind: "pdf",
        name: "PGA Rationale Memo — JB-LED-01",
        meta: "Generated by Azali · 2 pages",
        receivedHoursAgo: 4,
        lines: [
          { highlight: true, label: "Determination", value: "FDA DEV flag required · confidence 0.74" },
          { label: "Basis", value: "21 CFR §878.4810 — light-based devices for medical purposes" },
          { label: "Exemption", value: "General-wellness exemption likely unavailable on current claims" },
          { label: "Forward fix", value: "Artwork/claims cleanup could restore the exemption on future POs" },
        ],
        draft: RATIONALE_MEMOS["SHP-2220"],
      },
    ],
    events: [
      {
        title: "Packaging artwork requested",
        detail:
          "Asked Juniper for the retail packaging artwork — the device determination turns on the claims as printed.",
        icon: "mail",
        occurredHoursAgo: 8,
      },
      {
        title: "FDA determination drafted with rationale memo",
        detail:
          "Listing claims read as structure/function; the wellness exemption is likely unavailable — recommending the entry file with the FDA DEV flag.",
        icon: "ai",
        memo: true,
        occurredHoursAgo: 4,
        status: "current",
        steps: [
          "\u201cSkin rejuvenation\u201d + blue-light modes → intended-use analysis under §878.4810",
          "Retail box is wellness-only, but the listing language controls intended use",
          "DEV flag adds the FDA data set to the entry — no duty impact",
        ],
      },
    ],
    "alternates": null,
    "comparison": null,
    "citations": [
      {
        "href": "https://www.ecfr.gov/current/title-21/section-878.4810",
        "kind": "regulation",
        "quote": "Light-based devices intended for medical purposes are Class II devices requiring premarket notification.",
        "ref": "21 CFR §878.4810"
      },
      {
        "href": "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices",
        "kind": "regulation",
        "quote": "Products with claims limited to general wellness and low safety risk are not regulated as medical devices.",
        "ref": "FDA General Wellness Guidance"
      },
      {
        "kind": "evidence",
        "quote": "“LED light therapy facial mask — red & blue light modes for skin rejuvenation” — the claim language on the listing.",
        "documentName": "Product Listing — JB-LED-01",
        "ref": "Listing · JB-LED-01"
      },
      {
        "kind": "evidence",
        "quote": "There are no medical claims on the retail box, only 'wellness' language.",
        "ref": "Email · ops@juniperbeautylabs.com"
      }
    ],
    "approveLabel": "Approve FDA Filing",
    "canRequestInfo": true
  },
  "SHP-2225": {
    documents: [
      {
        kind: "pdf",
        name: "Commercial Invoice INV-4471",
        meta: "Bosch Fertigung GmbH · 5 pages",
        receivedHoursAgo: 30,
        summary:
          "Intercompany invoice from the German parent: 11,000 RW-4471 sensor housings at $8.40/unit ($92,400) — 18% under the trailing unrelated-seller average of $10.25 for the same part. Related-party pricing triggers the circumstances-of-sale review before entry summary.",
        lines: [
          { label: "Invoice", value: "INV-4471 · intercompany" },
          { highlight: true, label: "Seller", value: "Bosch Fertigung GmbH (parent company)" },
          { label: "Part", value: "RW-4471 sensor housing" },
          { highlight: true, label: "Unit price", value: "$8.40 × 11,000 units = $92,400" },
          { label: "Terms", value: "FCA Hamburg (Incoterms 2020)" },
          { label: "Relationship", value: "Buyer and seller under common control" },
        ],
      },
      {
        kind: "pdf",
        name: "Transfer Pricing Study — Extract",
        meta: "FY2025 study · relevant pages",
        receivedHoursAgo: 28,
        lines: [
          { label: "Method", value: "TNMM · tested party: US distributor" },
          { highlight: true, label: "Arm's-length range", value: "Operating margin 2.1%–4.8% · tested result 3.4%" },
          { label: "Coverage", value: "Includes part family RW-44xx" },
          { label: "Prepared by", value: "Independent advisor · FY2025" },
        ],
      },
      {
        kind: "pdf",
        name: "12-Month Price Comparison",
        meta: "Generated by Azali · entry history",
        receivedHoursAgo: 1,
        lines: [
          { highlight: true, label: "Unrelated sellers (12-mo avg)", value: "$10.25/unit (n = 7 entries)" },
          { label: "This invoice", value: "$8.40/unit (−18%)" },
          { label: "Prior related-party entries", value: "$8.35–8.55/unit · all liquidated without question" },
          { label: "Volume", value: "Parent supplies at contract volume; unrelated sellers quote spot" },
        ],
      },
      {
        kind: "pdf",
        name: "Valuation Rationale Memo — RW-4471",
        meta: "Generated by Azali · 2 pages",
        receivedHoursAgo: 1,
        lines: [
          { highlight: true, label: "Recommendation", value: "Accept transaction value · confidence 0.71" },
          { label: "Legal frame", value: "19 USC §1401a(b)(2)(B) — circumstances of sale" },
          { label: "Support", value: "TP study in range · consistent prior pricing · volume explanation" },
          { label: "Risk", value: "§1592 exposure reaches prior entries at the same price" },
        ],
        draft: RATIONALE_MEMOS["SHP-2225"],
      },
    ],
    events: [
      {
        title: "AI flagged related-party pricing",
        detail:
          "Invoice price is 18% under the unrelated-seller average for the same part — circumstances-of-sale review required before entry summary.",
        icon: "ai",
        occurredHoursAgo: 28,
        status: "warning",
        steps: [
          "Unrelated sellers, same part, trailing 12 months: avg $10.25/unit",
          "This invoice: $8.40/unit → −18.0% vs the unrelated average",
        ],
      },
      {
        title: "Valuation memo drafted",
        detail:
          "Circumstances-of-sale test supported by the transfer pricing study, consistent prior pricing, and the volume explanation — recommending transaction value be accepted.",
        icon: "ai",
        memo: true,
        occurredHoursAgo: 1,
        status: "current",
      },
    ],
    "alternates": null,
    "comparison": null,
    "citations": [
      {
        "href": "https://www.law.cornell.edu/uscode/text/19/1401a",
        "kind": "regulation",
        "quote": "Transaction value between related persons is acceptable where circumstances of sale indicate the relationship did not influence the price.",
        "ref": "19 USC §1401a(b)(2)(B)"
      },
      {
        "kind": "evidence",
        "quote": "Prior related-party entries for this part ran $8.35–8.55/unit and were accepted at liquidation.",
        "documentName": "12-Month Price Comparison",
        "ref": "Entry history · RW-4471"
      },
      {
        "kind": "evidence",
        "quote": "Seller: Meridian GmbH (parent company) · $8.40/unit × 11,000 units = $92,400.",
        "documentName": "Commercial Invoice INV-4471",
        "ref": "Invoice INV-4471"
      },
      {
        "href": "https://www.law.cornell.edu/uscode/text/19/1592",
        "kind": "regulation",
        "quote": "Penalties for entry of merchandise by fraud, gross negligence, or negligence — exposure reaches prior entries at the same price.",
        "ref": "19 USC §1592"
      }
    ],
    "approveLabel": "Accept Transaction Value",
    "canRequestInfo": true
  },
  "SHP-2230": {
    documents: [
      {
        kind: "pdf",
        name: "HTS Revision Notice — Heading 6404",
        meta: "USITC revision record · reference",
        receivedHoursAgo: 25,
        summary:
          "Mid-year HTS revision subdivides 6404.11.90 by upper material. Tariff Radar swept the Summit catalog: 132 SKUs affected, 129 reassigned automatically — the TR-9 trail runner is one of three needing a manual call because its upper mixes textile mesh and synthetic overlays.",
        lines: [
          { highlight: true, label: "Change", value: "6404.11.90 subdivided by constituent material of the upper" },
          { label: "Effective", value: "Current period (mid-year revision)" },
          { label: "Summit SKUs affected", value: "132 · 129 auto-reassigned · 3 manual" },
          { label: "Duty", value: "20% under both old and new lines — statistical change only" },
        ],
      },
      {
        kind: "pdf",
        name: "Spec — TR-9 Trail Runner",
        meta: "Summit Footwear · 2 pages",
        receivedHoursAgo: 24,
        lines: [
          { label: "Style", value: "TR-9 trail runner" },
          { highlight: true, label: "Upper", value: "78% textile mesh / 22% synthetic overlays (by surface area)" },
          { label: "Sole", value: "Rubber · cemented construction" },
          { highlight: true, label: "Value", value: "$13.58/pair — over the $12 statistical line" },
          { label: "Units", value: "3,800 pairs this shipment" },
        ],
      },
      {
        kind: "pdf",
        name: "Classification Rationale Memo — TR-9",
        meta: "Generated by Azali · 1 page",
        receivedHoursAgo: 23,
        lines: [
          { highlight: true, label: "Recommendation", value: "6404.11.90 (new statistical suffix) · confidence 0.91" },
          { label: "Basis", value: "Textile upper controls (78% by surface) · >$12/pair" },
          { label: "Duty impact", value: "$0 — ten-digit statistical change only" },
        ],
        draft: RATIONALE_MEMOS["SHP-2230"],
      },
    ],
    events: [
      {
        title: "Tariff Radar triggered a reclassification sweep",
        detail:
          "The 6404 split touched 132 Summit SKUs; 129 were reassigned automatically on unambiguous specs.",
        icon: "ai",
        occurredHoursAgo: 25,
      },
      {
        title: "Reclassified TR-9 with rationale memo",
        detail:
          "Textile mesh controls the upper at 78% by surface area and the value break is clear — codes-only correction before the Savannah filing.",
        icon: "ai",
        memo: true,
        occurredHoursAgo: 23,
        status: "current",
        steps: [
          "Upper: 78% textile mesh / 22% synthetic overlays → textile line",
          "$13.58/pair → over-$12 statistical break",
          "Codes-only correction — $0 duty impact",
        ],
      },
    ],
    "alternates": null,
    "comparison": null,
    "citations": [
      {
        "href": "https://hts.usitc.gov/search?query=6404.11",
        "kind": "regulation",
        "quote": "Subheading 6404.11.90 is subdivided according to the constituent material of the upper.",
        "ref": "USITC HTS Rev. (mid-year)"
      },
      {
        "kind": "catalog",
        "quote": "129 sibling SKUs were reassigned automatically under the new subdivision.",
        "ref": "Catalog · Summit Footwear"
      },
      {
        "kind": "evidence",
        "quote": "Upper: 78% textile mesh / 22% synthetic overlays (by surface area) · rubber sole.",
        "documentName": "Spec — TR-9 Trail Runner",
        "ref": "Spec · TR-9"
      }
    ],
    "approveLabel": "Approve",
    "canRequestInfo": false
  },
  "SHP-2233": {
    documents: [
      {
        kind: "email",
        from: "export@rheinwerk-praezision.de",
        subject: "SHP-2233 — shipping docs, Bremerhaven sailing",
        body: "Documents for the spindle shipment attached: commercial invoice and packing list. B/L to follow from the forwarder once the vessel departs Bremerhaven.",
        meta: "Email · 2 attachments",
        receivedHoursAgo: 42,
      },
      {
        kind: "pdf",
        name: "Commercial Invoice INV-7702",
        meta: "Rheinwerk Präzision · 2 pages",
        receivedHoursAgo: 40,
        summary:
          "Invoice for 140 RW-2205 precision spindles at $1,026.43/unit ($143,700) from Rheinwerk Präzision, Stuttgart — with the country-of-origin field left blank. Origin is required for entry; every other signal (seller address, Hamburg lading, 14 prior entries) points to Germany.",
        lines: [
          { label: "Invoice", value: "INV-7702 · Net 60" },
          { label: "Seller", value: "Rheinwerk Präzision GmbH, Stuttgart" },
          { label: "Part", value: "RW-2205 precision spindle · 140 units" },
          { label: "Unit price", value: "$1,026.43 · total $143,700" },
          { highlight: true, label: "Country of origin", value: "(blank) — required for entry" },
          { label: "Port of lading", value: "Hamburg" },
          { label: "Terms", value: "CIP Houston (Incoterms 2020)" },
        ],
      },
      {
        kind: "email",
        from: "export@rheinwerk-praezision.de",
        subject: "RE: SHP-2233 — country of origin confirmation",
        body: "Confirming country of origin: Germany. All RW-2205 spindles are machined and assembled at our Nürnberg plant. Signed manufacturer's declaration attached — apologies for the blank field on the invoice.",
        meta: "Email · 1 attachment",
        receivedHoursAgo: 2,
      },
      {
        kind: "pdf",
        name: "Manufacturer's Declaration — RW-2205",
        meta: "Rheinwerk Präzision · 1 page",
        receivedHoursAgo: 2,
        lines: [
          { highlight: true, label: "Declaration", value: "Country of origin: Germany (Nürnberg plant)" },
          { label: "Scope", value: "Part RW-2205, all serials this shipment" },
          { label: "Signed", value: "K. Brandt, Export Compliance · Rheinwerk Präzision" },
        ],
      },
      {
        kind: "pdf",
        name: "Entry History — Part RW-2205",
        meta: "Generated by Azali · entry history",
        receivedHoursAgo: 1,
        lines: [
          { highlight: true, label: "Prior entries for RW-2205", value: "14 · all origin DE" },
          { label: "Most recent", value: "3 weeks ago" },
          { label: "Duty impact", value: "None (no special tariffs for DE)" },
        ],
      },
    ],
    events: [
      {
        title: "AI flagged missing origin",
        detail:
          "The invoice's country-of-origin field is blank — origin is required before the entry can file.",
        icon: "ai",
        occurredHoursAgo: 40,
        status: "warning",
      },
      {
        title: "Chase email sent to the supplier",
        detail:
          "Requested written origin confirmation and a manufacturer's declaration from Rheinwerk's export team.",
        icon: "mail",
        occurredHoursAgo: 38,
      },
      {
        title: "Origin confirmed: Germany",
        detail:
          "Supplier declaration, seller address, Hamburg lading, and 14 prior entries all agree — proposing DE with the declaration on file.",
        icon: "ai",
        occurredHoursAgo: 1,
        status: "current",
        steps: [
          "Manufacturer's declaration: machined and assembled at the Nürnberg plant",
          "14 prior entries for RW-2205, all declared DE and accepted",
        ],
      },
    ],
    "alternates": null,
    "comparison": null,
    "citations": [
      {
        "href": "https://www.ecfr.gov/current/title-19/section-134.11",
        "kind": "regulation",
        "quote": "Every article of foreign origin imported into the United States shall be marked to indicate the country of origin.",
        "ref": "19 CFR §134.11"
      },
      {
        "kind": "evidence",
        "quote": "14 prior entries for part RW-2205, all declared origin DE and accepted.",
        "documentName": "Entry History — Part RW-2205",
        "ref": "Entry history · RW-2205"
      },
      {
        "kind": "evidence",
        "quote": "Seller: Rheinwerk Präzision GmbH, Stuttgart · country-of-origin field blank · port of lading Hamburg.",
        "documentName": "Commercial Invoice INV-7702",
        "ref": "Invoice INV-7702"
      },
      {
        "href": "https://hts.usitc.gov/search?query=8483.10",
        "kind": "regulation",
        "quote": "8483.10.3050: Free (column 1 general) — no Section 232/301 action for German origin.",
        "ref": "HTSUS 8483.10.3050"
      }
    ],
    "approveLabel": "Approve Origin",
    "canRequestInfo": false
  },
  // Hand-authored: the LUX-SP210 CF-28 case (principal-function dispute).
  // The commercial invoice is a real PDF in apps/web/public/docs.
  "ENT-3979": {
    documents: [
      {
        kind: "pdf",
        name: "Commercial Invoice — AZ-INV-20259-4471",
        meta: "Ningbo Lumina Acoustics · 1 page",
        receivedHoursAgo: 2260,
        src: "/docs/commercial-invoice-azali.pdf",
        summary:
          "Three-line invoice from Ningbo Lumina Acoustics totaling $48,556 FOB Ningbo-Zhoushan. The supplier's own line description calls the LUX-SP210 an “LED table lamp with integrated Bluetooth speaker” and suggests 8513.10.40 — that wording is the likely CF-28 trigger. The spec sheet, cost data, and retail packaging support the entered 8518.22.0000.",
        lines: [
          { label: "Invoice", value: "AZ-INV-20259-4471 · 05 Feb" },
          { label: "Reference", value: "PO-88231 / ENT-3979" },
          { label: "Seller", value: "Ningbo Lumina Acoustics Co., Ltd." },
          { label: "Terms", value: "FOB Ningbo-Zhoushan (Incoterms 2020) · Net 30" },
          { label: "Transport", value: "Ocean · COSCO Universe 095E · B/L COSU6398471250" },
          {
            highlight: true,
            label: "Line 1",
            value: "2,400 × LUX-SP210 @ $18.75 — “LED table lamp with integrated Bluetooth speaker”",
          },
          { label: "Line 2", value: "2,400 × lamp shade/diffuser @ $1.10 (9405.92.0000)" },
          { label: "Line 3", value: "120 × USB-C cable kit @ $2.30 (8544.42.9090)" },
          {
            highlight: true,
            label: "Supplier HTS note",
            value: "8513.10.40 suggested — “as entered: 8518.22.0000, under CBP review”",
          },
          { label: "Packing", value: "200 cartons · 1 × 20' FCL · G.W. 3,120 kg" },
          { highlight: true, label: "Total invoice value", value: "USD 48,556.00" },
        ],
      },
      {
        kind: "pdf",
        name: "Packing List — PO-88231",
        meta: "Ningbo Lumina Acoustics · 2 pages",
        receivedHoursAgo: 2258,
        src: "/docs/packing-list-azali.pdf",
        summary:
          "200 cartons in one 20' FCL — 160 of LUX-SP210 units, 30 of shade assemblies, 10 of cable kits (4,920 units · 2,760 kg net / 3,120 kg gross). Quantities match the invoice line-for-line, and the lithium-ion battery handling declaration (UN3481, PI 967) is present.",
        lines: [
          { label: "Ship date", value: "22 Jan · Ningbo Lumina Acoustics" },
          { label: "Reference", value: "PO-88231 · Invoice AZ-INV-20259-4471" },
          {
            highlight: true,
            label: "Line 1",
            value: "160 ctn · 2,400 pcs LUX-SP210 (LSP210-BLK) · 2,280 kg",
          },
          { label: "Line 2", value: "30 ctn · 2,400 pcs shade/diffuser (LSP210-DIF) · 360 kg" },
          { label: "Line 3", value: "10 ctn · 120 sets USB-C kit (LSP210-CBL) · 120 kg" },
          {
            highlight: true,
            label: "Totals",
            value: "200 cartons · 4,920 units · 2,760 kg net / 3,120 kg gross",
          },
          { label: "Handling", value: "Li-ion batteries UN3481, PI 967 · keep dry" },
          { label: "Package type", value: "Cartons · 1 × 20' FCL" },
        ],
      },
      {
        kind: "pdf",
        name: "Bill of Lading — AZ-BOL-20259-0417",
        meta: "COSCO Shipping Lines · 1 page",
        receivedHoursAgo: 2256,
        src: "/docs/bill-of-lading-azali.pdf",
        summary:
          "COSCO ocean FCL under B/L AZ-BOL-20259-0417 — container CMAU-4471893, sealed, aboard COSCO Universe 095E: 200 cartons, 3,120 kg, declared value $48,556 FOB Ningbo. References PO-88231 and the invoice — and the shipper's own special instructions note the HTS is under CBP review.",
        lines: [
          { label: "B/L", value: "AZ-BOL-20259-0417 · SCAC COSU" },
          { label: "Carrier", value: "COSCO Shipping Lines / Norton Lilly (inland)" },
          {
            highlight: true,
            label: "Container",
            value: "CMAU-4471893 · seals SL-8842019/20 · COSCO Universe 095E",
          },
          { label: "Freight", value: "3rd party — billed to the importer of record" },
          { label: "Cargo", value: "200 cartons · 3,120 kg gross · 1 × 20' FCL" },
          { highlight: true, label: "Declared value", value: "USD 48,556.00 · FOB Ningbo" },
          {
            highlight: true,
            label: "Special instructions",
            value: "“HTS under CBP review — 8518.22.0000 entered / 8513.10.40”",
          },
          { label: "Pickup", value: "22 Jan · signed W. Zhang / M. Torres (COSCO)" },
        ],
      },
      {
        kind: "pdf",
        name: "Spec Sheet — LUX-SP210",
        meta: "Ningbo Lumina Acoustics · 6 pages",
        receivedHoursAgo: 2250,
        src: "/docs/spec-sheet-lux-sp210.pdf",
        summary:
          "Customer-approved product specification (rev. 2) for the LUX-SP210. The BOM cost split — audio 55% · power 25% · lighting 20% — is recorded on the spec itself “for classification & valuation support,” and the “Portable Bluetooth Speaker” retail box header is a 100% inspection checkpoint. Export packing matches the packing list carton-for-carton.",
        lines: [
          { label: "Product", value: "LUX-SP210 · ref LSP210-BLK · PO-88231 · rev. 2" },
          {
            label: "Audio",
            value: "3W full-range driver · BT 5.0 · tuned aluminium enclosure · SNR ≥ 80 dB",
          },
          { label: "Lighting", value: "Dimmable LED ring · 3 settings · 2700 K · frosted diffuser" },
          {
            label: "Power",
            value: "5,000 mAh Li-ion · USB-C · ≥ 8 h audio / ≥ 12 h light · UN38.3",
          },
          {
            highlight: true,
            label: "Cost contribution",
            value: "Audio 55% · power 25% · lighting 20% — “for classification & valuation support”",
          },
          {
            highlight: true,
            label: "Retail box header",
            value: "“Portable Bluetooth Speaker” — 100% inspection checkpoint",
          },
          { label: "Export packing", value: "15/carton · 160 cartons · 2,400 pcs · gross 3,120 kg" },
          { label: "Compliance", value: "CE · FCC 15B · RoHS · UN38.3 / UN3481 (PI 967)" },
        ],
      },
      {
        kind: "pdf",
        name: "Classification Rationale Memo — LUX-SP210",
        meta: "Generated by Azali · 2 pages",
        receivedHoursAgo: 2230,
        lines: [
          { highlight: true, label: "Recommendation", value: "8513.10.40 · confidence 0.84" },
          { label: "Alternate", value: "8518.22.0000 · confidence 0.62" },
          { label: "Legal frame", value: "Section XVI, Note 3 — principal function" },
          { label: "Precedent", value: "NY N305672 (supporting) · NY N327431 (distinguished)" },
        ],
        draft: CLASSIFICATION_MEMO,
      },
      {
        kind: "pdf",
        name: "CBP Form 28 — Request for Information",
        meta: "Received via ACE · 3 pages",
        receivedHoursAgo: 50,
        src: "/docs/cbp-form-28-request-for-information.pdf",
        summary:
          "Import Specialist D. Okafor (NIS Team 733 — Consumer Products & Machinery, Newark) requests the basis for 8518.22.0000 on ENT-3979 and 10 open entries: product literature, a component cost/weight breakdown, and a sample of the LUX-SP210. The officer's message leans on the invoice and retail-packaging wording; the reply must establish which component predominates — by cost, weight, and consumer use — within 30 days.",
        lines: [
          {
            highlight: true,
            label: "HTSUS at issue",
            value: "8518.22.0000 entered → 8513.10.40 proposed",
          },
          {
            highlight: true,
            label: "CBP asks",
            value: "Essential character under GRI 3(b) — which component predominates by cost, weight, consumer use",
          },
          {
            label: "Furnish",
            value: "B — product literature · C — component cost breakdown · D — sample (LUX-SP210)",
          },
          {
            label: "Officer message",
            value: "“Invoice and retail packaging describe the article primarily as a LED table lamp…”",
          },
          { label: "Entries covered", value: "ENT-3979 (entered 10/18) + 10 open entries" },
          { label: "Reply window", value: "30 days from request (19 USC §1509) · via ACE" },
          {
            label: "From",
            value: "Import Specialist D. Okafor · NIS Team 733 · New York/Newark (1001)",
          },
        ],
      },
      {
        kind: "pdf",
        name: "Draft Response — Entry ENT-3979",
        meta: "Generated by Azali · 4 pages + 5 exhibits",
        receivedHoursAgo: 2,
        lines: [
          { highlight: true, label: "Position", value: "Concede 8513.10.40 — per the rationale memo written at entry" },
          { label: "Legal frame", value: "Section XVI, Note 3 — principal function is illumination" },
          { label: "Precedent", value: "NY N305672 (controlling) · NY N327431 (distinguished)" },
          { highlight: true, label: "Corrective action", value: "Tender +$1,700 this entry · ~$19K across 11 entries · no-penalty request" },
          { label: "Exhibits", value: "A spec · B photos · C cost breakdown · D packaging · E rationale memo" },
        ],
        draft: CF28_RESPONSE_DRAFT,
      },
    ],
    events: [
      {
        title: "Entry documents extracted",
        detail:
          "Commercial invoice AZ-INV-20259-4471 parsed: 3 line items, $48,556 total, FOB Ningbo-Zhoushan.",
        icon: "ai",
        occurredHoursAgo: 2240,
        steps: [
          "2,400 × LUX-SP210 @ $18.75 · 2,400 × shade assemblies · 120 × cable kits",
          "Invoice ↔ packing list ↔ B/L reconciled: quantities, weights, and value agree",
          "Container CMAU-4471893 · COSCO Universe 095E · Port of NY/Newark (1001)",
        ],
      },
      {
        title: "Classified 8513.10.40 with rationale memo",
        detail:
          "Principal function analysis (Section XVI, Note 3): the supplier holds the article out as a lamp — spec sheet, invoice wording, and runtime all point to 8513.10.40. Confidence 0.84.",
        icon: "ai",
        memo: true,
        occurredHoursAgo: 2230,
      },
      {
        title: "Broker override: entry filed as 8518.22.0000",
        detail:
          "The broker selected the lower-confidence alternate 8518.22.0000 (0.62) over the recommended 8513.10.40 and approved the entry under it. The memo's scrutiny flag was recorded.",
        icon: "user",
        occurredHoursAgo: 2225,
        status: "warning",
      },
      {
        title: "Entry filed and cargo released",
        detail:
          "Filed via ABI under 8518.22.0000; released without exam. Liquidation pending.",
        icon: "check",
        occurredHoursAgo: 2150,
      },
      {
        title: "CBP Form 28 received via ACE",
        detail:
          "CBP questions 8518.22.0000 across 11 open entries and indicates 8513.10.40 — the code Azali recommended at entry.",
        icon: "mail",
        occurredHoursAgo: 50,
        status: "warning",
      },
      {
        title: "Agent rebuilt the entry file",
        detail:
          "Everything CBP asked for already existed in the file — retrieval, not excavation.",
        icon: "ai",
        occurredHoursAgo: 40,
        steps: [
          "Pulled invoice, spec sheet, 7501, and the original classification rationale memo",
          "9 prior entries, same SKU, all liquidated as entered under 8518.22.0000",
          "Component cost breakdown located: audio 55% · power 25% · lighting 20%",
        ],
      },
      {
        title: "Corrected response drafted for broker sign-off",
        detail:
          "Concedes 8513.10.40 per the entry-time memo, tenders the duty difference, and requests no penalties on the strength of the documented reasonable care.",
        icon: "ai",
        occurredHoursAgo: 2,
        status: "current",
        steps: [
          "Position: agree to reclassification — the memo recommended 8513.10.40 at entry",
          "Tender computed: +$1,700 this entry · ~$19K across 11 open entries",
          "Reasonable-care record assembled: memo, override log, prompt correction",
        ],
      },
    ],
    alternates: null,
    comparison: null,
    citations: [
      {
        href: "https://www.law.cornell.edu/cfr/text/19/177.2",
        kind: "regulation",
        quote:
          "Composite machines are classified as being that machine which performs the principal function.",
        ref: "HTSUS Section XVI, Note 3",
      },
      {
        href: "https://www.law.cornell.edu/uscode/text/19/1509",
        kind: "regulation",
        quote:
          "CBP may examine records and request information to ascertain the correctness of any entry.",
        ref: "19 USC §1509",
      },
      {
        href: "https://rulings.cbp.gov/ruling/N305672",
        kind: "ruling",
        quote:
          "A camping lantern with a speaker feature (3W monaural) is classified in 8513.10 — the lighting-dominant configuration controlling here.",
        ref: "CROSS NY N305672",
      },
      {
        href: "https://rulings.cbp.gov/ruling/N327431",
        kind: "ruling",
        quote:
          "An audio-dominant speaker/lantern (10W stereo, speaker-led marketing) classified in 8518.22 — distinguishable from the LUX-SP210 on its facts.",
        ref: "CROSS NY N327431",
      },
      {
        documentName: "Spec Sheet — LUX-SP210",
        kind: "evidence",
        quote:
          "Product function: “portable rechargeable table lamp with integrated Bluetooth loudspeaker” — the supplier's own approved specification, holding the article out as a lamp.",
        ref: "Spec: product function",
      },
      {
        documentName: "Commercial Invoice — AZ-INV-20259-4471",
        kind: "evidence",
        quote:
          "“Portable rechargeable LED table lamp with integrated Bluetooth speaker … HTS 8513.10.40” — the supplier's own description, consistent with the entry-time recommendation.",
        ref: "Invoice AZ-INV-20259-4471",
      },
      {
        documentName: "CBP Form 28 — Request for Information",
        kind: "evidence",
        quote:
          "State the essential character of the LUX-SP210 and identify which component (loudspeaker vs. lamp) predominates by cost, weight, and consumer use.",
        ref: "CBP Form 28 · ENT-3979",
      },
    ],
    approveLabel: "Approve & File Response",
    canRequestInfo: false,
  },
};
