// Generated from apps/web/src/data/review-queue.ts — the demo agent traces,
// keyed by shipment reference. Regenerate via the extraction script if the
// mock traces change.

export interface SeedTraceStep {
  kind: string;
  title: string;
  detail: string;
  data?: string[];
  citationRef?: string;
}

export interface SeedTracePhase {
  label: string;
  steps: SeedTraceStep[];
}

export const REVIEW_TRACES: Record<string, SeedTracePhase[]> = {
  "ENT-4471": [
    {
      "label": "Ingestion",
      "steps": [
        {
          "citationRef": "Docs · PRI-3301 / PL / B-L",
          "data": [
            "Seller: Shenzhen Kaida Trading Co. · Buyer: Pacific Rim Imports",
            "Terms: FOB Shanghai · Currency: USD",
            "Σ 24 line values = $186,400.00 — matches printed total exactly"
          ],
          "detail": "6 pages, 24 line items · extracted 118 fields (descriptions, quantities, unit prices, totals). Lowest field confidence 0.94 — line 17 quantity — cross-confirmed against the packing list.",
          "kind": "read",
          "title": "Parsed Commercial Invoice PRI-3301"
        },
        {
          "citationRef": "Docs · PRI-3301 / PL / B-L",
          "detail": "Carton counts and gross weights matched invoice quantities on all 24 lines. Bill of lading consignee matches importer of record 36-4821997; port of lading Shanghai matches invoice terms.",
          "kind": "read",
          "title": "Parsed packing list & bill of lading"
        },
        {
          "citationRef": "Docs · PRI-3301 / PL / B-L",
          "detail": "Invoice ↔ packing list ↔ B/L agreed on quantity, weight, consignee, and value on every line. 0 conflicts found across 72 field comparisons.",
          "kind": "check",
          "title": "Three-way document reconciliation"
        }
      ]
    },
    {
      "label": "Classification",
      "steps": [
        {
          "citationRef": "Classification Engine · 24 entries",
          "detail": "24 of 24 lines matched previously approved catalog entries — 22 by exact SKU, 2 by description similarity ≥ 0.97. No new classification decisions were required.",
          "kind": "lookup",
          "title": "Matched all 24 lines against the catalog"
        },
        {
          "citationRef": "HTSUS Column 1 rates",
          "detail": "None of the 24 subheadings were touched by the mid-year HTS revision, and no Section 301/232 changes affect these HTS/origin pairs since Pacific Rim's last entry.",
          "kind": "check",
          "title": "Re-validated codes against the current HTS"
        },
        {
          "citationRef": "AD/CVD case registry",
          "detail": "No anti-dumping or countervailing orders on these HTS/origin pairs. No FDA, USDA, or EPA flags — all lines are consumer goods outside PGA scope.",
          "kind": "flag",
          "title": "Screened AD/CVD and PGA requirements"
        },
        {
          "citationRef": "USTR Section 301 · List 4A",
          "data": [
            "In scope: 22 of 24 lines · $92,521 entered value",
            "Measure: 9903.88.15 (List 4A) @ 7.5% — no active exclusions match",
            "Out of scope: 2 Ch. 94 lines outside the 301 lists"
          ],
          "detail": "China origin triggers the Section 301 check. Walked each subheading through the Chapter 99 lists and the exclusion registry — List 4A applies to 22 lines; no exclusion covers them.",
          "kind": "lookup",
          "title": "Stacked Chapter 99 measures (Section 301)"
        }
      ]
    },
    {
      "label": "Duty computation",
      "steps": [
        {
          "data": [
            "Ch. 85 (14 lines): $102,300 @ 0–2.6% = $1,890.40",
            "Ch. 94 (7 lines): $61,200 @ 3.9% = $2,386.80",
            "Ch. 39 (3 lines): $22,900 @ 5.3% = $1,213.70",
            "Ch. 99 · 301 List 4A (9903.88.15): 7.5% × $92,521 = $6,939.10",
            "Total estimated duty: $12,430.00 (MPF/HMF itemized separately)"
          ],
          "citationRef": "HTSUS Column 1 rates",
          "detail": "Computed line by line across 3 HTS chapters, then stacked the Section 301 surcharge on the in-scope lines.",
          "kind": "calc",
          "title": "Computed duties"
        },
        {
          "citationRef": "Entry history · Pacific Rim",
          "detail": "Effective rate 6.7% is consistent with Pacific Rim's trailing 12-month average of 6.5% for this product mix — no anomaly.",
          "kind": "check",
          "title": "Sanity-checked duty against client history"
        }
      ]
    },
    {
      "label": "Decision",
      "steps": [
        {
          "citationRef": "19 CFR §142.2",
          "detail": "Vessel ETA ≈ 5 hours. Filing pre-arrival secures release on arrival and avoids port storage charges.",
          "kind": "check",
          "title": "Filing-window check"
        },
        {
          "detail": "Every line sits at ≥98% confidence — above the auto-file threshold — but entry transmission always requires licensed sign-off under your firm's policy. Queued.",
          "kind": "decision",
          "title": "Assembled entry ENT-4471 · queued for sign-off"
        }
      ]
    }
  ],
  "SHP-2209": [
    {
      "label": "Ingestion",
      "steps": [
        {
          "data": [
            "12 line items · 34 fields extracted",
            "Printed TOTAL (page 2): $48,250.00 · OCR confidence 0.98",
            "Σ line items (1–12): $45,780.00"
          ],
          "citationRef": "Invoice INV-88231",
          "detail": "2 pages. Every line item extracted with confidence ≥ 0.96 — the printed total itself read cleanly, so this is not an OCR error.",
          "kind": "read",
          "title": "Parsed Commercial Invoice INV-88231"
        },
        {
          "citationRef": "Packing list PL-88231",
          "detail": "Quantities and unit prices on PL-88231 match invoice lines 1–12 exactly — 24 of 24 field comparisons agree with the line items.",
          "kind": "read",
          "title": "Parsed packing list PL-88231"
        },
        {
          "citationRef": "Email · ops@harborfoods.com",
          "detail": "Client asked to clear before the weekend (DC appointment Monday). Deadline registered against the Savannah ETA.",
          "kind": "read",
          "title": "Read the client's intake email"
        }
      ]
    },
    {
      "label": "Verification",
      "steps": [
        {
          "data": [
            "Σ(line items) $45,780.00 ≠ printed total $48,250.00",
            "Discrepancy: −$2,470.00 (5.1% of declared value)"
          ],
          "citationRef": "Invoice INV-88231",
          "detail": "The arithmetic cross-check failed.",
          "kind": "flag",
          "title": "Cross-checked totals — MISMATCH"
        },
        {
          "citationRef": "Packing list PL-88231",
          "detail": "Tested and rejected: freight/insurance add-on (CIF charges already itemized on line 12); currency mix-up (single USD column); missing page (page count complete, line numbering contiguous). The residual explanation is a typo in the printed total.",
          "kind": "lookup",
          "title": "Tested common causes for the gap"
        },
        {
          "data": [
            "Declared @ $48,250 → est. duty $12,798",
            "Declared @ $45,780 → est. duty $12,118",
            "Δ ≈ $680 overpaid if the printed total is used"
          ],
          "detail": "Quantified what the wrong choice would cost.",
          "kind": "calc",
          "title": "Computed the duty impact of each value"
        }
      ]
    },
    {
      "label": "Decision",
      "steps": [
        {
          "citationRef": "19 CFR §141.86(a)",
          "detail": "The regulation requires an accurate itemized statement of the purchase price — the itemization is the stronger legal evidence, and the packing list corroborates it.",
          "kind": "lookup",
          "title": "Checked the legal standard for declared value"
        },
        {
          "detail": "Value discrepancies above your $500 threshold always route to a human. Proposing the line-item sum ($45,780) with the packing list as support.",
          "kind": "decision",
          "title": "Queued for broker decision"
        }
      ]
    }
  ],
  "SHP-2214": [
    {
      "label": "Ingestion",
      "steps": [
        {
          "data": [
            "“AX5400 tri-band wireless mesh Wi-Fi 6 router, 2-pack, model RBK762”",
            "Line value: $128,000.00 · Country of origin: Taiwan"
          ],
          "citationRef": "Invoice BW-5540 · line 3",
          "detail": "Lines 1 and 2 (cables, extender) matched the catalog automatically — only line 3 required classification.",
          "kind": "read",
          "title": "Parsed invoice line 3"
        },
        {
          "citationRef": "Invoice BW-5540 · line 3",
          "detail": "Attributes extracted: wireless router · data transmission and reception · consumer networking · sold as a 2-pack (router + satellite unit) · Wi-Fi 6 / tri-band.",
          "kind": "lookup",
          "title": "Extracted product attributes"
        }
      ]
    },
    {
      "label": "Research",
      "steps": [
        {
          "citationRef": "Catalog · BW-EXT-003",
          "detail": "No exact SKU match. Closest precedent: Bluewave's mesh extender EX-3, approved under 8517.62.0090 in March — same principal function, same client.",
          "kind": "lookup",
          "title": "Searched the classification catalog"
        },
        {
          "citationRef": "CROSS NY N324089",
          "data": [
            "Query: “mesh wi-fi router system” → 14 rulings returned",
            "Top match: NY N324089 · similarity 0.94",
            "Holding: mesh system (router + satellites) → 8517.62.00, free"
          ],
          "detail": "Direct CBP precedent for the product configuration.",
          "kind": "lookup",
          "title": "Queried the CROSS rulings database"
        },
        {
          "citationRef": "HTSUS Heading 8517",
          "detail": "Heading 8517 covers machines for reception, conversion, and transmission of data — the principal-function test governs which subheading applies.",
          "kind": "read",
          "title": "Read the heading terms"
        },
        {
          "citationRef": "HTSUS Heading 8517",
          "detail": "8517.69 (“other apparatus”) applies only where transmission/reception is not the principal function. For a router it plainly is. Posterior for 8517.69: 0.11 — rejected but surfaced as the alternate.",
          "kind": "check",
          "title": "Considered and rejected 8517.69"
        },
        {
          "citationRef": "HTSUS Ch. 99, Subch. III",
          "detail": "Origin Taiwan — outside the Section 301 China lists, and no Section 232 or other Chapter 99 measure reaches 8517.62. No surcharge stacks on this entry.",
          "kind": "check",
          "title": "Checked Chapter 99 exposure — none"
        }
      ]
    },
    {
      "label": "Verification & decision",
      "steps": [
        {
          "citationRef": "GRI 3(b)",
          "detail": "The 2-pack could arguably be a GRI 3(b) set. Both components classify identically, so the outcome doesn't change — but the unresolved framing question caps confidence below your threshold.",
          "kind": "check",
          "title": "GRI set analysis on the 2-pack"
        },
        {
          "citationRef": "HTSUS Heading 8517",
          "data": [
            "8517.62.0090: Free → $0 duty",
            "8517.69.0000: Free → $0 duty",
            "Rate identical either way — the risk is precedent accuracy, not money"
          ],
          "detail": "Duty is unaffected by the choice.",
          "kind": "calc",
          "title": "Computed duty under both codes"
        },
        {
          "detail": "Proposed 8517.62.0090 at 87% — below the 95% auto-file threshold solely because of the set question. Queued with the alternate attached.",
          "kind": "decision",
          "title": "Proposal queued for review"
        }
      ]
    }
  ],
  "SHP-2218": [
    {
      "label": "Ingestion",
      "steps": [
        {
          "data": [
            "Scan 1: CBP Form 1300 — Vessel Entrance or Clearance Statement",
            "Scan 2: CBP Form 6059B — Customs Declaration (traveler)"
          ],
          "citationRef": "19 CFR §4.61",
          "detail": "Two scans arrived on the client email for the yacht import. Form types identified from layout and OMB numbers; both OCR'd including handwriting.",
          "kind": "read",
          "title": "Classified both scanned forms"
        },
        {
          "citationRef": "Booking · SHP-2218",
          "data": [
            "Vessel: “Harmonie” · 49′4″ yacht · USA flag",
            "Route: Simpson Bay, SX → Culebra, PR · Agent: Karen Smith"
          ],
          "detail": "Vessel name, route, and agent all match SHP-2218's booking — this is the supporting document.",
          "kind": "check",
          "title": "Matched the CBP 1300 to this entry"
        }
      ]
    },
    {
      "label": "Verification",
      "steps": [
        {
          "citationRef": "Scan · CBP Form 1300",
          "data": [
            "Box 3 (handwritten): 01 MAY 2020",
            "CBP stamp: MAY 01 2022 · Voyage calls: 17–24 APR 22",
            "2 of 3 date signals say 2022 → handwritten year = pen slip"
          ],
          "detail": "Internal date conflict resolved by majority evidence — the stamp is machine-applied and the voyage particulars are contemporaneous.",
          "kind": "check",
          "title": "Resolved the 1300's internal date conflict"
        },
        {
          "citationRef": "Scan · CBP Form 6059B",
          "detail": "Traveler “Armstrong, Nel A.”, countries visited Germany/Kuwait/Qatar/UK, stamped March 2010. No field overlaps this transaction — wrong person, wrong trip, wrong decade.",
          "kind": "flag",
          "title": "Ruled out the 6059B entirely"
        }
      ]
    },
    {
      "label": "Decision",
      "steps": [
        {
          "citationRef": "19 CFR §4.61",
          "detail": "The vessel clearance statement is the correct instrument for this entry. Proposing: accept the 1300 with the year read as 2022; return the 6059B to Windward as misfiled.",
          "kind": "decision",
          "title": "Accept CBP 1300 · set aside 6059B"
        }
      ]
    }
  ],
  "SHP-2216": [
    {
      "label": "Ingestion",
      "steps": [
        {
          "data": [
            "Shell: 55% wool / 45% polyester",
            "Lining: 100% polyester · Units: 3,800"
          ],
          "citationRef": "Spec sheet SA-2241",
          "detail": "Fabric composition extracted from the spec sheet; the commercial invoice hasn't arrived yet, so the spec sheet is the controlling evidence for now.",
          "kind": "read",
          "title": "Parsed spec sheet SA-2241"
        },
        {
          "citationRef": "Email · merch@solsticeapparel.com",
          "detail": "Emailed Solstice's merch team to confirm composition; reply confirmed 55/45 wool-poly per the mill certificate and promised the invoice will match.",
          "kind": "check",
          "title": "Confirmed composition with the client"
        }
      ]
    },
    {
      "label": "Research",
      "steps": [
        {
          "citationRef": "HTSUS Ch. 62, Subheading Note 2",
          "detail": "Classification follows the fabric of the outer shell, not the lining — the chief-weight fibre of the shell governs. At 55% by weight, wool is chief weight.",
          "kind": "read",
          "title": "Applied the chapter note"
        },
        {
          "citationRef": "CROSS HQ 960950",
          "detail": "Ruling on a 55/45 wool-polyester woven blazer confirms subheading 6204.31 (of wool) rather than 6204.33 (of synthetic fibres).",
          "kind": "lookup",
          "title": "Found matching CROSS precedent"
        }
      ]
    },
    {
      "label": "Verification & decision",
      "steps": [
        {
          "data": [
            "6204.31.2010 (wool): 17.5% × $64,200 = $11,235",
            "6204.33.5010 (synthetic): 26.9% × $64,200 = $17,270",
            "Δ duty at stake: $6,035 — wait on invoice? No: spec + mill cert suffice"
          ],
          "citationRef": "HTSUS 6204 rate lines",
          "detail": "A 5-point composition error on the final invoice would flip the code and add ~$4,120–6,000 in duty exposure.",
          "kind": "calc",
          "title": "Quantified the misclassification risk"
        },
        {
          "detail": "Marginal chief-weight calls (within 10 points of 50/50) route to a human under your thresholds even with a mill certificate. Proposing 6204.31.2010 with the synthetic code as alternate.",
          "kind": "decision",
          "title": "Queued — composition is close to the line"
        }
      ]
    }
  ],
  "SHP-2220": [
    {
      "label": "Ingestion",
      "steps": [
        {
          "data": [
            "“LED light therapy facial mask — red & blue light modes for skin rejuvenation”",
            "Power: USB-C · 5V · Units: 6,500"
          ],
          "citationRef": "Listing · JB-LED-01",
          "detail": "The claim language is the regulatory trigger — “light therapy” and “rejuvenation” both pattern-match device claims.",
          "kind": "read",
          "title": "Parsed the product listing"
        },
        {
          "citationRef": "Email · ops@juniperbeautylabs.com",
          "detail": "Requested the retail packaging artwork from Juniper; their reply says the box uses only “wellness” language with no medical claims — artwork attached but not yet verified against the listing.",
          "kind": "check",
          "title": "Requested packaging evidence from the client"
        }
      ]
    },
    {
      "label": "Research",
      "steps": [
        {
          "citationRef": "21 CFR §878.4810",
          "detail": "Light-based devices intended for medical purposes are Class II — importation would require premarket notification and an FDA prior notice on entry.",
          "kind": "lookup",
          "title": "Checked the device regulation"
        },
        {
          "citationRef": "FDA General Wellness Guidance",
          "detail": "Products with claims limited to general wellness and low safety risk fall outside device regulation. Comparable LED masks have cleared both ways — the packaging claims decide it.",
          "kind": "lookup",
          "title": "Checked the wellness carve-out"
        }
      ]
    },
    {
      "label": "Decision",
      "steps": [
        {
          "data": [
            "With FDA flag: prior notice + possible exam · no penalty risk",
            "Without flag, if CBP disagrees: refused entry, exam delays, re-export costs"
          ],
          "citationRef": "21 CFR §878.4810",
          "detail": "Asymmetric downside — over-flagging costs days; under-flagging can cost the shipment.",
          "kind": "calc",
          "title": "Compared the failure modes"
        },
        {
          "detail": "Proposing to file WITH the FDA prior notice (conservative path) at 74% confidence. The packaging artwork could justify dropping the flag — a broker should make that call.",
          "kind": "decision",
          "title": "Queued with the conservative default"
        }
      ]
    }
  ],
  "SHP-2225": [
    {
      "label": "Ingestion",
      "steps": [
        {
          "data": [
            "Seller: Meridian GmbH (parent company) · related party",
            "Unit price: $8.40 × 11,000 units = $92,400"
          ],
          "citationRef": "Invoice INV-4471",
          "detail": "Corporate registry match flagged the seller as the importer's parent — this invoice is a related-party transaction under 19 USC 1401a.",
          "kind": "read",
          "title": "Parsed invoice INV-4471 · relationship detected"
        }
      ]
    },
    {
      "label": "Price testing",
      "steps": [
        {
          "data": [
            "Unrelated sellers, same part, trailing 12 months: avg $10.25/unit (n=7 entries)",
            "This invoice: $8.40/unit → −18.0% vs. unrelated average",
            "Prior related-party entries: $8.35–8.55/unit · all liquidated without question"
          ],
          "citationRef": "Entry history · RW-4471",
          "detail": "Built the comparison set from your entry history — the price is below unrelated benchmarks but consistent with the client's own related-party history.",
          "kind": "calc",
          "title": "Ran the circumstances-of-sale price test"
        },
        {
          "citationRef": "19 USC §1401a(b)(2)(B)",
          "detail": "Transaction value between related persons is acceptable where circumstances of sale show the relationship didn't influence the price. Consistent historical pricing supports that — but 18% is beyond your 15% review threshold.",
          "kind": "lookup",
          "title": "Applied the valuation statute"
        }
      ]
    },
    {
      "label": "Decision",
      "steps": [
        {
          "data": [
            "If undervaluation found: back-duties across all prior entries + penalties (19 USC 1592)",
            "Missing evidence: transfer-pricing study or CoS documentation"
          ],
          "citationRef": "19 USC §1592",
          "detail": "The exposure isn't this entry's duty — it's the retroactive liability across every prior entry at this price.",
          "kind": "flag",
          "title": "Sized the downside"
        },
        {
          "detail": "Proposing to accept transaction value at 71% — supported by history and prior liquidations — but a transfer-pricing study would settle it. Request Info is wired to ask Meridian for exactly that.",
          "kind": "decision",
          "title": "Queued — evidence would resolve this"
        }
      ]
    }
  ],
  "SHP-2230": [
    {
      "label": "Trigger",
      "steps": [
        {
          "citationRef": "USITC HTS Rev. (mid-year)",
          "detail": "Tariff Radar detected the mid-year revision splitting 6404.11.90 by upper material and launched a reclassification sweep across Summit's catalog: 132 SKUs affected.",
          "kind": "flag",
          "title": "HTS revision hit Summit's footwear codes"
        },
        {
          "citationRef": "Catalog · Summit Footwear",
          "detail": "129 of 132 SKUs had upper compositions far from any boundary and were reassigned automatically. Three — including TR-9 — sit close enough to a line to warrant a human look.",
          "kind": "decision",
          "title": "Auto-reassigned the clear cases"
        }
      ]
    },
    {
      "label": "Analysis",
      "steps": [
        {
          "data": [
            "Upper: 78% textile mesh / 22% synthetic overlays (by surface area)",
            "New split: textile-dominant → 6404.11.9050 · synthetic-dominant → sibling code"
          ],
          "citationRef": "Spec · TR-9",
          "detail": "Textile governs at 78% — but overlay measurement methodology (surface area vs. weight) can shift borderline uppers, which is why this queued.",
          "kind": "read",
          "title": "Re-measured TR-9's upper composition"
        },
        {
          "citationRef": "USITC HTS Rev. (mid-year)",
          "data": [
            "Old code and new code both carry 20% duty",
            "Codes-only correction — $0 duty impact"
          ],
          "detail": "The stakes are record accuracy, not money.",
          "kind": "calc",
          "title": "Confirmed duty is unchanged"
        },
        {
          "detail": "Proposing 6404.11.9050 at 91%. Approving teaches the engine your overlay-measurement preference for the remaining borderline SKUs.",
          "kind": "decision",
          "title": "Proposal queued"
        }
      ]
    }
  ],
  "SHP-2233": [
    {
      "label": "Ingestion",
      "steps": [
        {
          "data": [
            "Seller: Rheinwerk Präzision GmbH, Stuttgart, DE",
            "Country of origin field: (blank)",
            "Port of lading: Hamburg"
          ],
          "citationRef": "Invoice INV-7702",
          "detail": "Origin is a required entry element — the blank field blocks the entry from advancing.",
          "kind": "read",
          "title": "Parsed invoice INV-7702 · found the gap"
        }
      ]
    },
    {
      "label": "Inference",
      "steps": [
        {
          "citationRef": "Entry history · RW-2205",
          "data": [
            "Prior entries for part RW-2205: 14 · declared origin DE on all 14",
            "Most recent: 3 weeks ago · liquidated without question"
          ],
          "detail": "Seller address, lading port, and the part's complete entry history triangulate to German origin with no contradicting signal.",
          "kind": "lookup",
          "title": "Triangulated origin from three signals"
        },
        {
          "data": [
            "DE origin: no Section 232/301 exposure for 8483.10.3050",
            "Duty impact of the inference: $0 (Free either way)"
          ],
          "citationRef": "HTSUS 8483.10.3050",
          "detail": "Low monetary stakes — but origin declarations are penalty events if wrong, so the inference still needs sign-off.",
          "kind": "calc",
          "title": "Checked tariff exposure for DE"
        }
      ]
    },
    {
      "label": "Decision",
      "steps": [
        {
          "citationRef": "19 CFR §134.11",
          "detail": "Origin marking and declaration are mandatory. Proposing DE at 85%; approving also triggers a note to Atlas asking the supplier to fix the invoice template.",
          "kind": "decision",
          "title": "Proposed DE · queued for confirmation"
        }
      ]
    }
  ],
  // Hand-authored: the LUX-SP210 CF-28 case.
  "ENT-3979": [
    {
      "label": "Reading the notice",
      "steps": [
        {
          "citationRef": "CBP Form 28 · ENT-3979",
          "data": [
            "CBP Form 28 · Entry ENT-3979 · issued at New York/Newark (1001)",
            "Scope: 11 open entries · same SKU · liquidation pending",
            "Ask: essential character under GRI 3(b) — cost, weight, consumer use",
            "Reply due in 30 days (19 USC \u00a71509) \u00b7 Import Specialist D. Okafor, NIS Team 733"
          ],
          "detail": "Parsed the ACE notification. CBP is probing whether the lamp function makes the LUX-SP210 a lamp — a principal-function dispute, and the response clock started at issuance.",
          "kind": "read",
          "title": "Parsed CBP Form 28"
        },
        {
          "citationRef": "19 USC §1509",
          "detail": "The Form 28 demands product literature, component cost data, and marketing materials — exactly the records §1509 entitles CBP to examine. All three already exist in the file.",
          "kind": "check",
          "title": "Mapped what CBP is entitled to ask"
        }
      ]
    },
    {
      "label": "Rebuilding the file",
      "steps": [
        {
          "detail": "Retrieved the entry file: commercial invoice AZ-INV-20259-4471, LUX-SP210 spec sheet, the filed 7501, and the classification rationale memo written at first entry. Retrieval, not excavation.",
          "kind": "lookup",
          "title": "Pulled the entry file for ENT-3979"
        },
        {
          "citationRef": "Component cost breakdown",
          "data": [
            "Audio subsystem (drivers, amp, BT module): ≈55% of component cost",
            "Battery + power management: ≈25% · LED lighting: ≈20%",
            "Retail box header: “Portable Bluetooth Speaker”"
          ],
          "detail": "Cost composition, design emphasis, and marketing all point the same direction: the article is a speaker with a lamp feature, not the inverse.",
          "kind": "read",
          "title": "Extracted the principal-function evidence"
        },
        {
          "data": [
            "9 prior entries · same SKU · 8518.22.0000",
            "All liquidated as entered — no Form 29, no rate advance"
          ],
          "detail": "A consistent, unchallenged entry history is the core of the reasonable-care record.",
          "kind": "check",
          "title": "Compiled the entry history"
        }
      ]
    },
    {
      "label": "Precedent",
      "steps": [
        {
          "citationRef": "CROSS NY N305672",
          "detail": "The controlling analog: a lighting-dominant lantern with speaker feature classifies in 8513.10 — the same conclusion the rationale memo reached at entry.",
          "kind": "lookup",
          "title": "Re-confirmed the controlling ruling"
        },
        {
          "citationRef": "CROSS NY N327431",
          "data": [
            "N327431 device: 10W stereo · speaker-led marketing → 8518.22",
            "LUX-SP210: 3W mono · lamp-first spec and invoice → distinguishable"
          ],
          "detail": "The ruling the override leaned on is distinguishable on its facts — the LUX-SP210 is not the audio-dominant article it describes.",
          "kind": "check",
          "title": "Distinguished the override's ruling"
        }
      ]
    },
    {
      "label": "Exposure",
      "steps": [
        {
          "data": [
            "Corrected duty (8513.10.40 · 3.5% + 301 List 4A 7.5%): $5,342",
            "Tender: +$1,700 this entry · ~$19K across 11 open entries",
            "Penalty posture: memo + override log + prompt correction = reasonable care"
          ],
          "detail": "Computed the tender the concession requires — and the §1592 mitigation the entry-time memo buys.",
          "kind": "calc",
          "title": "Computed the tender and penalty posture"
        }
      ]
    },
    {
      "label": "Decision",
      "steps": [
        {
          "citationRef": "HTSUS Section XVI, Note 3",
          "detail": "Drafted the corrected response: concede 8513.10.40 per the entry-time memo, tender the difference, request no penalties on the documented reasonable-care record.",
          "kind": "decision",
          "title": "Drafted the corrected response"
        },
        {
          "detail": "Form 28 responses require licensed sign-off before transmission — everything filed here becomes the §1592 record if CBP escalates to a Form 29.",
          "kind": "flag",
          "title": "Queued for broker sign-off"
        }
      ]
    }
  ]
};
