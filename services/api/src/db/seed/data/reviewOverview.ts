// Generated from apps/web/src/data/review-queue.ts — per-reference demo
// overview content (documents, activity events, alternates, comparison).
// Regenerate via the extraction script if the mock data changes.

export interface SeedDocumentLine {
  label: string;
  value: string;
  highlight?: boolean;
}

export type SeedDocument =
  | { kind: "pdf"; name: string; meta: string; receivedHoursAgo: number; lines: SeedDocumentLine[]; note?: string }
  | { kind: "email"; from: string; subject: string; body: string; meta: string; receivedHoursAgo: number }
  | { kind: "scan"; name: string; meta: string; receivedHoursAgo: number; src: string; extracted: SeedDocumentLine[]; note?: string };

export interface SeedActivityEvent {
  title: string;
  detail?: string;
  steps?: string[];
  occurredHoursAgo: number;
  icon: "ai" | "check" | "mail";
  status?: string;
}

export interface SeedOverview {
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
    "comparison": null
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
    "comparison": null
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
    "comparison": null
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
    }
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
    "comparison": null
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
    "comparison": null
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
    "comparison": null
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
    "comparison": null
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
    "comparison": null
  },
  "ENT-3979": {
    "documents": [
      {
        "kind": "pdf",
        "lines": [
          {
            "label": "Entry no.",
            "value": "ENT-3979 · liquidation pending"
          },
          {
            "highlight": true,
            "label": "CBP asks",
            "value": "Basis for classification under 8467.21.0030"
          },
          {
            "label": "Response due",
            "value": "30 days from issue date"
          },
          {
            "label": "Port",
            "value": "Seattle (3001)"
          }
        ],
        "meta": "Received via ACE · 1 page",
        "name": "CBP Form 28 — Request for Information",
        "note": "CBP is questioning a March entry's classification — the response clock is running.",
        "receivedHoursAgo": 50
      },
      {
        "kind": "pdf",
        "lines": [
          {
            "label": "Exhibit A",
            "value": "Commercial invoice + product spec"
          },
          {
            "label": "Exhibit B",
            "value": "CROSS NY N302876 (impact drivers)"
          },
          {
            "label": "Exhibit C",
            "value": "Entry history · 9 prior entries"
          },
          {
            "highlight": true,
            "label": "Position",
            "value": "8467.21.0030 affirmed"
          }
        ],
        "meta": "Generated by Azali · 6 pages + 3 exhibits",
        "name": "Draft Response — Entry ENT-3979",
        "receivedHoursAgo": 2
      }
    ],
    "events": [
      {
        "detail": "CBP is questioning the classification basis on a liquidation-pending entry.",
        "icon": "mail",
        "occurredHoursAgo": 50,
        "status": "warning",
        "title": "CBP Form 28 received via ACE"
      },
      {
        "detail": "Response drafted with the ruling, product spec, and entry-history exhibits.",
        "icon": "ai",
        "occurredHoursAgo": 2,
        "status": "current",
        "steps": [
          "Pulled the full ENT-3979 entry file: invoice, spec, 7501, original decision",
          "Matched CROSS NY N302876 — cordless impact drivers → 8467.21",
          "9 prior entries, same SKU, all liquidated as entered — reasonable-care record"
        ],
        "title": "AI assembled the evidence package"
      }
    ],
    "alternates": null,
    "comparison": null
  }
};
