// Generated from apps/web/src/data/review-queue.ts — per-reference demo
// overview content (documents, activity events, alternates, comparison).
// Regenerate via the extraction script if the mock data changes.
// (ENT-3979 is hand-authored: the TrailGlow CF-28 case.)

import { CF28_RESPONSE_DRAFT, CLASSIFICATION_MEMO } from "./cf28ResponseDraft";

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
  alternates: Array<{ value: string; detail: string; confidence: number }> | null;
  comparison: { docA: string; docB: string; rows: Array<{ label: string; a: string; b: string }> } | null;
}

export const REVIEW_OVERVIEW: Record<string, SeedOverview> = {
  "ENT-4471": {
    "documents": [
      {
        "kind": "pdf",
        "lines": [
          {
            "label": "Entry no.",
            "value": "AZL-2026-4471"
          },
          {
            "label": "Importer of record",
            "value": "Pacific Rim Imports · 36-4821997"
          },
          {
            "label": "Lines",
            "value": "24"
          },
          {
            "label": "Declared value",
            "value": "$186,400"
          },
          {
            "highlight": true,
            "label": "Estimated duty",
            "value": "$12,430"
          },
          {
            "label": "Ch. 99 measures",
            "value": "301 List 4A · 7.5% (22 lines)"
          },
          {
            "label": "AD/CVD · PGA flags",
            "value": "None"
          }
        ],
        "meta": "CBP 7501 draft · 4 pages",
        "name": "Entry Summary Draft",
        "note": "All 24 lines matched classifications your team previously approved — nothing new to decide.",
        "receivedHoursAgo": 1
      },
      {
        "kind": "pdf",
        "lines": [
          {
            "label": "Seller",
            "value": "Shenzhen Kaida Trading Co."
          },
          {
            "label": "Buyer",
            "value": "Pacific Rim Imports"
          },
          {
            "label": "Terms",
            "value": "FOB Shanghai"
          },
          {
            "label": "Invoice total",
            "value": "$186,400"
          }
        ],
        "meta": "PDF · 6 pages",
        "name": "Commercial Invoice PRI-3301",
        "receivedHoursAgo": 26
      }
    ],
    "events": [
      {
        "detail": "24 of 24 lines matched approved catalog classifications.",
        "icon": "ai",
        "occurredHoursAgo": 1,
        "status": "current",
        "steps": [
          "Invoice ↔ packing list ↔ B/L: 72 field comparisons, 0 conflicts",
          "24/24 lines matched approved catalog entries (22 exact SKU, 2 similarity ≥0.97)",
          "Duty $12,430 = Ch. 85/94/39 base + Section 301 List 4A stack (9903.88.15) · AD/CVD and PGA screens clean"
        ],
        "title": "AI reconciled documents & computed duty"
      },
      {
        "icon": "check",
        "occurredHoursAgo": 0.5,
        "title": "Queued for licensed sign-off"
      }
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
    "documents": [
      {
        "kind": "pdf",
        "lines": [
          {
            "label": "Line items (12)",
            "value": "see page 1–2"
          },
          {
            "highlight": true,
            "label": "Sum of line items",
            "value": "$45,780"
          },
          {
            "highlight": true,
            "label": "Total (printed)",
            "value": "$48,250"
          },
          {
            "label": "Currency",
            "value": "USD"
          }
        ],
        "meta": "PDF · 2 pages",
        "name": "Commercial Invoice INV-88231",
        "note": "The two totals disagree by $2,470 — the packing list quantities support the line-item sum.",
        "receivedHoursAgo": 3
      },
      {
        "body": "Hi team — attached invoice and packing list for the Laem Chabang shipment. Please clear before the weekend if possible, we have a DC appointment Monday morning.",
        "from": "ops@harborfoods.com",
        "kind": "email",
        "meta": "Email · 2 attachments",
        "receivedHoursAgo": 3,
        "subject": "SHP-2209 — docs for Savannah arrival"
      }
    ],
    "events": [
      {
        "detail": "Printed total disagrees with the line-item sum by $2,470.",
        "icon": "ai",
        "occurredHoursAgo": 2,
        "status": "warning",
        "steps": [
          "Σ(12 line items) $45,780 ≠ printed total $48,250 (−5.1%)",
          "Ruled out freight add-ons, currency mix-up, and missing pages",
          "Packing list corroborates the line items → typo in the printed total"
        ],
        "title": "AI flagged a totals mismatch"
      }
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
    "documents": [
      {
        "kind": "pdf",
        "lines": [
          {
            "label": "Line 1",
            "value": "USB-C cables (2m) · $6,200"
          },
          {
            "label": "Line 2",
            "value": "Mesh extender EX-3 · $14,800"
          },
          {
            "highlight": true,
            "label": "Line 3",
            "value": "AX5400 tri-band mesh router, 2-pack · $128,000"
          },
          {
            "label": "Country of origin",
            "value": "Taiwan"
          }
        ],
        "meta": "PDF · 3 pages",
        "name": "Commercial Invoice BW-5540",
        "note": "Line 3 is the SKU in question — lines 1 and 2 matched the catalog automatically.",
        "receivedHoursAgo": 7
      },
      {
        "kind": "pdf",
        "lines": [
          {
            "label": "Merchandise",
            "value": "Mesh Wi-Fi system (router + satellites)"
          },
          {
            "highlight": true,
            "label": "Holding",
            "value": "8517.62.0090 · free of duty"
          },
          {
            "label": "Ruling date",
            "value": "March 2022"
          }
        ],
        "meta": "Reference · CBP rulings database",
        "name": "CROSS Ruling NY N324089",
        "note": "Closest precedent — a comparable consumer mesh system with the same principal function.",
        "receivedHoursAgo": 7
      }
    ],
    "events": [
      {
        "detail": "Below the 95% auto-file threshold — queued for review.",
        "icon": "ai",
        "occurredHoursAgo": 6,
        "status": "current",
        "steps": [
          "CROSS query “mesh wi-fi router system” → 14 rulings · top match NY N324089 (0.94)",
          "Catalog precedent: Bluewave's EX-3 extender approved under the same code",
          "Rejected 8517.69 (posterior 0.11) · GRI set question caps confidence at 87%"
        ],
        "title": "AI proposed 8517.62.0090 at 87%"
      }
    ],
    "alternates": [
      {
        "confidence": 0.11,
        "detail": "Other communication apparatus — 0% duty, weaker precedent fit",
        "value": "8517.69.0000"
      }
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
    "documents": [
      {
        "kind": "pdf",
        "lines": [
          {
            "label": "Style",
            "value": "SA-2241 women's blazer"
          },
          {
            "highlight": true,
            "label": "Shell",
            "value": "55% wool / 45% polyester"
          },
          {
            "label": "Lining",
            "value": "100% polyester"
          },
          {
            "label": "Units",
            "value": "3,800"
          }
        ],
        "meta": "PDF · 1 page",
        "name": "Spec Sheet — Style SA-2241",
        "note": "Chief weight decides the code — 55% wool puts it in 6204.31 at 17.5% instead of 26.9%.",
        "receivedHoursAgo": 12
      },
      {
        "body": "Confirming shell composition is 55/45 wool-poly per the mill certificate. The final commercial invoice will match the spec sheet — certificate attached for your records.",
        "from": "merch@solsticeapparel.com",
        "kind": "email",
        "meta": "Email · 1 attachment",
        "receivedHoursAgo": 6,
        "subject": "RE: SA-2241 fabric composition"
      }
    ],
    "events": [
      {
        "detail": "Asked the merch team to confirm SA-2241's fabric composition.",
        "icon": "mail",
        "occurredHoursAgo": 8,
        "title": "Info request sent to Solstice"
      },
      {
        "detail": "Client reply matches the spec sheet — wool is chief weight.",
        "icon": "ai",
        "occurredHoursAgo": 5,
        "status": "current",
        "title": "AI confirmed the chief-weight call"
      }
    ],
    "alternates": [
      {
        "confidence": 0.28,
        "detail": "Of synthetic fibres — 26.9% duty",
        "value": "6204.33.5010"
      }
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
    "documents": [
      {
        "kind": "pdf",
        "lines": [
          {
            "label": "Product",
            "value": "LED facial mask · SKU JB-LED-01"
          },
          {
            "highlight": true,
            "label": "Claims",
            "value": "“red & blue light for skin rejuvenation”"
          },
          {
            "label": "Power",
            "value": "USB-C · 5V"
          },
          {
            "label": "Units",
            "value": "6,500"
          }
        ],
        "meta": "PDF · 1 page",
        "name": "Product Listing — JB-LED-01",
        "note": "The wellness-vs-medical-device line turns on the claims printed on the packaging.",
        "receivedHoursAgo": 20
      },
      {
        "body": "Packaging files attached — there are no medical claims on the retail box, only 'wellness' language. Let us know if the FDA prior notice is still needed; we can adjust artwork for the next PO if that helps.",
        "from": "ops@juniperbeautylabs.com",
        "kind": "email",
        "meta": "Email · 1 attachment",
        "receivedHoursAgo": 5,
        "subject": "JB-LED-01 packaging artwork"
      }
    ],
    "events": [
      {
        "detail": "Asked Juniper for the retail packaging artwork.",
        "icon": "mail",
        "occurredHoursAgo": 8,
        "title": "Packaging artwork requested"
      }
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
    "documents": [
      {
        "kind": "pdf",
        "lines": [
          {
            "label": "Seller",
            "value": "Meridian GmbH (parent company)"
          },
          {
            "highlight": true,
            "label": "Unit price",
            "value": "$8.40"
          },
          {
            "label": "Quantity",
            "value": "11,000 units"
          },
          {
            "label": "Part",
            "value": "RW-4471 sensor housing"
          }
        ],
        "meta": "PDF · 5 pages",
        "name": "Commercial Invoice INV-4471",
        "note": "Related-party price sits 18% under the unrelated-seller average for the same part.",
        "receivedHoursAgo": 30
      },
      {
        "kind": "pdf",
        "lines": [
          {
            "highlight": true,
            "label": "Unrelated sellers (12-mo avg)",
            "value": "$10.25/unit"
          },
          {
            "label": "This invoice",
            "value": "$8.40/unit (−18%)"
          },
          {
            "label": "Prior related-party entries",
            "value": "$8.35–8.55/unit"
          }
        ],
        "meta": "Generated by Azali · entry history",
        "name": "12-Month Price Comparison",
        "receivedHoursAgo": 1
      }
    ],
    "events": [
      {
        "detail": "Invoice price is 18% under the unrelated-seller average.",
        "icon": "ai",
        "occurredHoursAgo": 28,
        "status": "warning",
        "title": "AI flagged related-party pricing"
      },
      {
        "detail": "Continuous bond utilization hit 82% after the new tariff stack — the surety requires updated financials before renewal. Renewal packet drafted.",
        "icon": "check",
        "occurredHoursAgo": 12,
        "status": "warning",
        "title": "Surety flagged bond utilization"
      }
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
    "documents": [
      {
        "kind": "pdf",
        "lines": [
          {
            "highlight": true,
            "label": "Change",
            "value": "6404.11.90 split by upper material"
          },
          {
            "label": "Effective",
            "value": "Current period (mid-year revision)"
          },
          {
            "label": "Summit SKUs affected",
            "value": "132 (129 auto-reassigned)"
          }
        ],
        "meta": "Reference · USITC revision record",
        "name": "HTS Revision Notice — Heading 6404",
        "note": "This item came from Tariff Radar — the code split left 3 SKUs needing a manual call.",
        "receivedHoursAgo": 25
      },
      {
        "kind": "pdf",
        "lines": [
          {
            "highlight": true,
            "label": "Upper",
            "value": "78% textile mesh / 22% synthetic overlays"
          },
          {
            "label": "Sole",
            "value": "Rubber"
          },
          {
            "label": "Style",
            "value": "TR-9 trail runner"
          }
        ],
        "meta": "PDF · 2 pages",
        "name": "Spec — TR-9 Trail Runner",
        "receivedHoursAgo": 24
      }
    ],
    "events": [
      {
        "detail": "129 of 132 affected SKUs were reassigned automatically.",
        "icon": "ai",
        "occurredHoursAgo": 25,
        "status": "current",
        "title": "Tariff Radar triggered a reclassification sweep"
      }
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
    "documents": [
      {
        "kind": "pdf",
        "lines": [
          {
            "label": "Seller",
            "value": "Rheinwerk Präzision GmbH, Stuttgart"
          },
          {
            "highlight": true,
            "label": "Country of origin",
            "value": "(blank)"
          },
          {
            "label": "Port of lading",
            "value": "Hamburg"
          },
          {
            "label": "Part",
            "value": "RW-2205 precision spindle"
          }
        ],
        "meta": "PDF · 2 pages",
        "name": "Commercial Invoice INV-7702",
        "note": "Origin is required for entry — every other signal on this shipment points to Germany.",
        "receivedHoursAgo": 40
      },
      {
        "kind": "pdf",
        "lines": [
          {
            "highlight": true,
            "label": "Prior entries for RW-2205",
            "value": "14 · all origin DE"
          },
          {
            "label": "Most recent",
            "value": "3 weeks ago"
          },
          {
            "label": "Duty impact",
            "value": "None (no special tariffs for DE)"
          }
        ],
        "meta": "Generated by Azali · entry history",
        "name": "Entry History — Part RW-2205",
        "receivedHoursAgo": 1
      }
    ],
    "events": [
      {
        "detail": "Seller address, lading port, and 14 prior entries all agree.",
        "icon": "ai",
        "occurredHoursAgo": 1,
        "status": "current",
        "title": "AI inferred German origin"
      }
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
