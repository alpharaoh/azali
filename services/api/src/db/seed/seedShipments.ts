/**
 * Seed shipments + shipment events (pipeline / review queue / autopilot feed)
 * for an organization. Ports the web app's mock data onto the org's real
 * seeded clients.
 *
 * Usage (from services/api):
 *   bun src/db/seed/seedShipments.ts <organizationId> <userId>
 */
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { insertShipment } from "@/db/queries/insert/insertShipment";
import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import * as schema from "@/db/schema";
import { ShipmentStage, ShipmentStatus } from "@/db/schemas/shipments";
import { REVIEW_OVERVIEW } from "./data/reviewOverview";
import { REVIEW_TRACES } from "./data/reviewTraces";

const [organizationId, userId] = process.argv.slice(2);

if (!organizationId || !userId) {
  console.error(
    "Usage: bun src/db/seed/seedShipments.ts <organizationId> <userId>",
  );
  process.exit(1);
}

const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 3_600_000);

interface SeedEvent {
  type: string;
  actor: "ai" | "user" | "system" | "cbp";
  title: string;
  occurredHoursAgo: number;
  payload?: Record<string, unknown>;
}

interface SeedShipment {
  clientName: string;
  reference: string;
  entryNumber?: string;
  stage: ShipmentStage;
  status: ShipmentStatus;
  originCountry: string;
  originPort: string;
  portOfEntry: string;
  transportMode: "ocean" | "air" | "truck" | "rail";
  conveyance?: string;
  etaHours: number;
  valueUsd: number;
  dutyUsd: number;
  incoterm?: string;
  entryType?: string;
  review?: {
    type:
      | "classification"
      | "document"
      | "enforcement"
      | "pga"
      | "valuation"
      | "signoff";
    question: string;
    deadlineHours: number;
    /** The legal clock behind the deadline, in broker terms. */
    deadlineReason: string;
    /** Set when the review answers a CBP notice — drives the red form badge. */
    noticeForm?: "CF-28" | "CF-29";
    confidence: number;
    proposal: { label: string; value: string; detail: string };
    /** Money consequence of the decision; alternates keyed by their value. */
    dutyImpact?: {
      proposed: { rate: string; amountUsd: number; breakdown: string[] };
      alternates?: Record<string, { amountUsd: number; deltaUsd: number }>;
    };
  };
  events: SeedEvent[];
}

const seeds: SeedShipment[] = [
  // ---- Review queue (needs_review) -----------------------------------------
  {
    clientName: "Williams-Sonoma",
    reference: "ENT-4471",
    entryNumber: "ENT-4471",
    stage: ShipmentStage.Entry,
    status: ShipmentStatus.NeedsReview,
    originCountry: "CN",
    originPort: "Shanghai",
    portOfEntry: "LA/Long Beach",
    transportMode: "ocean",
    conveyance: "COSCO Harmony 112E",
    etaHours: 14,
    valueUsd: 186400,
    dutyUsd: 12430,
    incoterm: "FOB",
    entryType: "01 — Consumption",
    review: {
      type: "signoff",
      question: "Entry ready to file — needs licensed sign-off",
      deadlineHours: 1.5,
      deadlineReason: "File before vessel arrival",
      confidence: 0.98,
      proposal: {
        label: "File entry",
        value: "ENT-4471",
        detail: "All 24 lines classified; duty $12,430 computed and bonded.",
      },
      dutyImpact: {
        proposed: {
          rate: "Effective 6.7% incl. Section 301",
          amountUsd: 12430,
          breakdown: [
            "Ch. 85 (14 lines) 0–2.6%: $1,890",
            "Ch. 94 (7 lines) 3.9%: $2,387",
            "Ch. 39 (3 lines) 5.3%: $1,214",
            "Section 301 List 4A 7.5% (22 lines): $6,939",
            "MPF/HMF itemized on the 7501",
          ],
        },
      },
    },
    events: [
      { type: "document_extracted", actor: "ai", title: "Extracted 14 lines from commercial invoice", occurredHoursAgo: 9, payload: { confidence: 0.99 } },
      { type: "hts_lookup", actor: "ai", title: "Classified all lines against HTSUS", occurredHoursAgo: 7, payload: { confidence: 0.97 } },
      { type: "duty_calculated", actor: "ai", title: "Computed duty $9,300 across 14 lines", occurredHoursAgo: 5 },
    ],
  },
  {
    clientName: "Nestlé USA",
    reference: "SHP-2209",
    stage: ShipmentStage.Intake,
    status: ShipmentStatus.NeedsReview,
    originCountry: "CH",
    originPort: "Rotterdam",
    portOfEntry: "NY/NJ",
    transportMode: "ocean",
    conveyance: "Maersk Essen 031W",
    etaHours: 18,
    valueUsd: 45780,
    dutyUsd: 2300,
    incoterm: "CIF",
    review: {
      type: "document",
      question: "Invoice total conflicts with line-item sum",
      deadlineHours: 3,
      deadlineReason: "Value must resolve before filing",
      confidence: 0.93,
      proposal: {
        label: "Use line-item sum",
        value: "$45,780.00",
        detail: "Printed total shows $48,250; 12 line items sum to $45,780 — the packing list supports the lines.",
      },
    },
    events: [
      { type: "email_received", actor: "system", title: "Invoice received from supplier", occurredHoursAgo: 12 },
      { type: "document_extracted", actor: "ai", title: "Extracted invoice totals and 12 line items", occurredHoursAgo: 11, payload: { confidence: 0.96 } },
      { type: "totals_reconciled", actor: "ai", title: "Detected $2,470 mismatch between header and lines", occurredHoursAgo: 10 },
    ],
  },
  {
    clientName: "TCL North America",
    reference: "SHP-2214",
    stage: ShipmentStage.Classification,
    status: ShipmentStatus.NeedsReview,
    // The agent trace reads origin Taiwan (no Section 301) — keep them agreeing.
    originCountry: "TW",
    originPort: "Kaohsiung",
    portOfEntry: "LA/Long Beach",
    transportMode: "ocean",
    conveyance: "OOCL Tokyo 084E",
    etaHours: 30,
    valueUsd: 128000,
    dutyUsd: 0,
    incoterm: "FOB",
    review: {
      type: "classification",
      question: "Which HTS code applies to the AX5400 mesh router?",
      deadlineHours: 6,
      deadlineReason: "Classification blocks entry prep",
      confidence: 0.87,
      proposal: {
        label: "HTS",
        value: "8517.62.0090",
        detail: "Machines for reception/conversion/transmission of voice or data.",
      },
      dutyImpact: {
        proposed: {
          rate: "Free (Column 1)",
          amountUsd: 0,
          breakdown: [
            "8517.62.0090: Free → $0 duty",
            "Origin Taiwan — no Section 301 exposure",
            "MPF 0.3464%: $443 · HMF 0.125%: $160",
          ],
        },
        alternates: {
          "8517.69.0000": { amountUsd: 0, deltaUsd: 0 },
        },
      },
    },
    events: [
      { type: "document_extracted", actor: "ai", title: "Extracted product specs from datasheet", occurredHoursAgo: 20, payload: { confidence: 0.95 } },
      { type: "vector_search", actor: "ai", title: "Searched prior rulings for mesh Wi-Fi systems", occurredHoursAgo: 18 },
      { type: "hts_lookup", actor: "ai", title: "Candidate headings 8517.62 vs 8517.69 compared", occurredHoursAgo: 16, payload: { confidence: 0.87 } },
    ],
  },
  {
    clientName: "Caterpillar",
    reference: "SHP-2218",
    stage: ShipmentStage.Intake,
    status: ShipmentStatus.NeedsReview,
    originCountry: "JP",
    originPort: "Yokohama",
    portOfEntry: "Chicago",
    transportMode: "ocean",
    conveyance: "NYK Meteor 118E",
    etaHours: 44,
    valueUsd: 415000,
    dutyUsd: 20800,
    incoterm: "FOB",
    review: {
      type: "document",
      question: "Two scanned CBP forms disagree — which one supports this entry?",
      deadlineHours: 12,
      deadlineReason: "Entry blocked on correct 7501",
      confidence: 0.78,
      proposal: {
        label: "Use",
        value: "CBP 7501 (rev. B)",
        detail: "Rev. B matches the invoice value; rev. A predates the amended PO.",
      },
    },
    events: [
      { type: "scan_received", actor: "system", title: "Two scanned CBP 7501 drafts received", occurredHoursAgo: 30 },
      { type: "document_extracted", actor: "ai", title: "OCR extracted both scans for comparison", occurredHoursAgo: 28, payload: { confidence: 0.9 } },
      { type: "documents_compared", actor: "ai", title: "Found value mismatch between rev. A and rev. B", occurredHoursAgo: 26 },
    ],
  },
  {
    clientName: "H&M Hennes & Mauritz",
    reference: "SHP-2216",
    stage: ShipmentStage.Classification,
    status: ShipmentStatus.NeedsReview,
    originCountry: "IN",
    originPort: "Nhava Sheva (JNPT)",
    portOfEntry: "Savannah",
    transportMode: "ocean",
    conveyance: "MSC Ilona 226W",
    etaHours: 60,
    valueUsd: 64200,
    dutyUsd: 11235,
    incoterm: "FOB",
    review: {
      type: "classification",
      question: "Wool or synthetic? Chief-weight call on the SA-2241 blazer",
      deadlineHours: 26,
      deadlineReason: "Classify before Savannah filing",
      confidence: 0.82,
      proposal: {
        label: "HTS",
        value: "6204.31.20",
        detail: "Lab report shows 52% wool by weight — wool chief-weight applies.",
      },
      dutyImpact: {
        proposed: {
          rate: "17.5% (wool chief weight)",
          amountUsd: 11235,
          breakdown: [
            "6204.31.20 · 17.5% × $64,200: $11,235",
            "MPF 0.3464%: $222 · HMF 0.125%: $80",
          ],
        },
        alternates: {
          "6204.33.5010": { amountUsd: 17270, deltaUsd: 6035 },
        },
      },
    },
    events: [
      { type: "document_extracted", actor: "ai", title: "Extracted fabric composition from mill certificate", occurredHoursAgo: 40, payload: { confidence: 0.88 } },
      { type: "hts_lookup", actor: "ai", title: "Compared 6204.31 (wool) vs 6204.33 (synthetic)", occurredHoursAgo: 38 },
    ],
  },
  {
    clientName: "L'Oréal USA",
    reference: "SHP-2220",
    stage: ShipmentStage.Compliance,
    status: ShipmentStatus.NeedsReview,
    originCountry: "FR",
    originPort: "Le Havre",
    portOfEntry: "NY/NJ",
    transportMode: "ocean",
    conveyance: "CMA CGM Liberty 204W",
    etaHours: 68,
    valueUsd: 38900,
    dutyUsd: 1900,
    incoterm: "DDP",
    review: {
      type: "pga",
      question: "Does the LED facial mask need an FDA device flag?",
      deadlineHours: 30,
      deadlineReason: "FDA prior notice before arrival",
      confidence: 0.74,
      proposal: {
        label: "PGA flag",
        value: "FDA DEV — required",
        detail: "Marketed with therapeutic claims; general wellness exemption likely unavailable.",
      },
    },
    events: [
      { type: "document_extracted", actor: "ai", title: "Extracted product claims from packaging artwork", occurredHoursAgo: 50, payload: { confidence: 0.91 } },
      { type: "vector_search", actor: "ai", title: "Searched FDA guidance on light-therapy devices", occurredHoursAgo: 48 },
    ],
  },
  {
    clientName: "Robert Bosch",
    reference: "SHP-2225",
    stage: ShipmentStage.Compliance,
    status: ShipmentStatus.NeedsReview,
    originCountry: "DE",
    originPort: "Hamburg",
    portOfEntry: "Savannah",
    transportMode: "ocean",
    conveyance: "Hapag Hamburg Express 077W",
    etaHours: 90,
    valueUsd: 92400,
    dutyUsd: 2310,
    incoterm: "FCA",
    review: {
      type: "valuation",
      question: "Related-party price is 18% below market — acceptable?",
      deadlineHours: 48,
      deadlineReason: "Valuation before entry summary",
      confidence: 0.71,
      proposal: {
        label: "Valuation",
        value: "Transaction value OK",
        detail: "Circumstances-of-sale test supported by transfer pricing study on file.",
      },
      dutyImpact: {
        proposed: {
          rate: "2.5% on transaction value",
          amountUsd: 2310,
          breakdown: [
            "Base 2.5% (Ch. 84 parts) × $92,400: $2,310",
            "MPF 0.3464%: $320 · HMF 0.125%: $116",
            "If transaction value were rejected: +18% dutiable base → +$416 exposure",
          ],
        },
      },
    },
    events: [
      { type: "document_extracted", actor: "ai", title: "Extracted intercompany invoice terms", occurredHoursAgo: 70, payload: { confidence: 0.93 } },
      { type: "market_comparison", actor: "ai", title: "Benchmarked price against unrelated-party sales", occurredHoursAgo: 66 },
    ],
  },
  {
    clientName: "Nike USA",
    reference: "SHP-2230",
    stage: ShipmentStage.Classification,
    status: ShipmentStatus.NeedsReview,
    originCountry: "VN",
    originPort: "Ho Chi Minh City (Cat Lai)",
    portOfEntry: "LA/Long Beach",
    transportMode: "ocean",
    conveyance: "Evergreen Ever Ace 041E",
    etaHours: 110,
    valueUsd: 51600,
    dutyUsd: 5184,
    incoterm: "FOB",
    review: {
      type: "classification",
      question: "Reassign trail runner TR-9 under the new 6404 split",
      deadlineHours: 72,
      deadlineReason: "Refile under revised 6404 split",
      confidence: 0.91,
      proposal: {
        label: "HTS",
        value: "6404.11.90",
        detail: "Athletic footwear, textile upper, over $12/pair — new statistical split.",
      },
      dutyImpact: {
        proposed: {
          rate: "20% (unchanged — statistical split only)",
          amountUsd: 5184,
          breakdown: [
            "Base 6404.11.90 · 20% on covered lines: $4,940",
            "MPF 0.3464%: $179 · HMF 0.125%: $65",
            "10-digit statistical change only — $0 duty impact",
          ],
        },
      },
    },
    events: [
      { type: "tariff_change_detected", actor: "ai", title: "Detected new 6404 statistical breakout", occurredHoursAgo: 96 },
      { type: "hts_lookup", actor: "ai", title: "Re-ran classification under revised nomenclature", occurredHoursAgo: 94, payload: { confidence: 0.91 } },
    ],
  },
  {
    clientName: "Siemens Industry",
    reference: "SHP-2233",
    stage: ShipmentStage.Intake,
    status: ShipmentStatus.NeedsReview,
    originCountry: "DE",
    originPort: "Bremerhaven",
    portOfEntry: "Houston",
    transportMode: "ocean",
    conveyance: "MSC Gülsün 118W",
    etaHours: 140,
    valueUsd: 143700,
    dutyUsd: 4300,
    incoterm: "CIP",
    review: {
      type: "document",
      question: "Country of origin missing on the Atlas invoice",
      deadlineHours: 96,
      deadlineReason: "Origin required for entry",
      confidence: 0.85,
      proposal: {
        label: "Origin",
        value: "DE (Germany)",
        detail: "Mill certificate and packing list both show Nürnberg plant.",
      },
    },
    events: [
      { type: "document_extracted", actor: "ai", title: "Extracted invoice — origin field blank", occurredHoursAgo: 110, payload: { confidence: 0.97 } },
      { type: "email_sent", actor: "ai", title: "Requested origin confirmation from supplier", occurredHoursAgo: 105 },
    ],
  },
  {
    clientName: "YETI",
    reference: "ENT-3979",
    entryNumber: "ENT-3979",
    stage: ShipmentStage.Released,
    status: ShipmentStatus.NeedsReview,
    originCountry: "CN",
    originPort: "Ningbo-Zhoushan",
    portOfEntry: "NY/NJ",
    transportMode: "ocean",
    conveyance: "COSCO Universe 095E",
    etaHours: -2160,
    valueUsd: 48556,
    dutyUsd: 3642,
    incoterm: "FOB",
    entryType: "01 — Consumption",
    review: {
      type: "enforcement",
      question:
        "CBP Form 28 questions the LUX-SP210 classification — response drafted",
      // Hours, not days: near the wire so the CF-28 surfaces at the top of
      // the queue (sorted by reviewDeadlineAt asc).
      deadlineHours: 5,
      deadlineReason: "CF-28 response due (day 30 of 30)",
      noticeForm: "CF-28",
      confidence: 0.92,
      proposal: {
        label: "Response",
        value: "Defend 8518.22.0000",
        detail:
          "Principal-function brief (Section XVI, Note 3): audio is 55% of component cost, the article is sold as a speaker, and NY N327431 is on point. The supplier's lamp-first invoice wording is addressed head-on.",
      },
      dutyImpact: {
        proposed: {
          rate: "As entered — Free + 301 List 4A 7.5%",
          amountUsd: 3642,
          breakdown: [
            "As entered (8518.22 Free + 301 List 4A 7.5%): $3,642 — paid",
            "If reclassified to 8513.10.40 (3.5% base): +$1,700 this entry",
            "Across 11 open entries: ~$19K + penalty exposure (19 USC §1592)",
          ],
        },
      },
    },
    events: [],
  },
  // ---- Flowing (autopilot / awaiting / released) ---------------------------
  {
    clientName: "Shiseido Americas",
    reference: "SHP-2226",
    stage: ShipmentStage.Classification,
    status: ShipmentStatus.Autopilot,
    originCountry: "KR",
    originPort: "Busan",
    portOfEntry: "LA/Long Beach",
    transportMode: "ocean",
    conveyance: "HMM Songdo 023E",
    etaHours: 52,
    valueUsd: 27400,
    dutyUsd: 1500,
    incoterm: "FOB",
    events: [
      { type: "invoice_received", actor: "system", title: "Commercial invoice received", occurredHoursAgo: 8 },
      { type: "document_extracted", actor: "ai", title: "Extracted 9 SKUs from invoice", occurredHoursAgo: 6, payload: { confidence: 0.98 } },
      { type: "hts_lookup", actor: "ai", title: "Classified 7 of 9 SKUs from catalog memory", occurredHoursAgo: 4, payload: { confidence: 0.96 } },
    ],
  },
  {
    clientName: "Milwaukee Tool",
    reference: "SHP-2228",
    stage: ShipmentStage.Compliance,
    status: ShipmentStatus.Autopilot,
    originCountry: "CN",
    originPort: "Ningbo-Zhoushan",
    portOfEntry: "Seattle",
    transportMode: "ocean",
    conveyance: "OOCL Spain 118W",
    etaHours: 36,
    valueUsd: 88200,
    dutyUsd: 4800,
    incoterm: "FOB",
    events: [
      { type: "hts_lookup", actor: "ai", title: "Classified 18 lines, all high confidence", occurredHoursAgo: 14, payload: { confidence: 0.97 } },
      { type: "section_301_check", actor: "ai", title: "Applied Section 301 List 3 duties", occurredHoursAgo: 10 },
    ],
  },
  {
    clientName: "Ashley Furniture Industries",
    reference: "SHP-2231",
    stage: ShipmentStage.Intake,
    status: ShipmentStatus.Autopilot,
    originCountry: "VN",
    originPort: "Ho Chi Minh City (Cat Lai)",
    portOfEntry: "Savannah",
    transportMode: "ocean",
    conveyance: "Wan Hai A16 067E",
    etaHours: 120,
    valueUsd: 63800,
    dutyUsd: 3500,
    incoterm: "FOB",
    events: [
      { type: "email_received", actor: "system", title: "Pre-alert received from forwarder", occurredHoursAgo: 3 },
      { type: "document_extracted", actor: "ai", title: "Extracted bill of lading details", occurredHoursAgo: 2, payload: { confidence: 0.99 } },
    ],
  },
  {
    clientName: "Trek Bicycle",
    reference: "SHP-2235",
    stage: ShipmentStage.Entry,
    status: ShipmentStatus.Autopilot,
    originCountry: "TW",
    originPort: "Kaohsiung",
    portOfEntry: "LA/Long Beach",
    transportMode: "air",
    conveyance: "KE214",
    etaHours: 20,
    valueUsd: 45100,
    dutyUsd: 2500,
    incoterm: "CIP",
    events: [
      { type: "duty_calculated", actor: "ai", title: "Computed duty $2,500 across 6 lines", occurredHoursAgo: 5, payload: { confidence: 0.98 } },
      { type: "entry_drafted", actor: "ai", title: "Drafted entry summary for filing", occurredHoursAgo: 3 },
    ],
  },
  {
    clientName: "Samsung Electronics America",
    reference: "SHP-2240",
    entryNumber: "ENT-4468",
    stage: ShipmentStage.Filed,
    status: ShipmentStatus.AwaitingCbp,
    originCountry: "CN",
    originPort: "Shanghai",
    portOfEntry: "LA/Long Beach",
    transportMode: "ocean",
    conveyance: "MSC Anna 226E",
    etaHours: 8,
    valueUsd: 152600,
    dutyUsd: 8400,
    incoterm: "FOB",
    entryType: "01 — Consumption",
    events: [
      { type: "duty_calculated", actor: "ai", title: "Computed duty $8,400", occurredHoursAgo: 26, payload: { confidence: 0.99 } },
      { type: "entry_filed", actor: "ai", title: "Filed entry ENT-4468 to ACE", occurredHoursAgo: 24 },
    ],
  },
  {
    clientName: "Gap Inc.",
    reference: "SHP-2238",
    entryNumber: "ENT-4465",
    stage: ShipmentStage.Filed,
    status: ShipmentStatus.AwaitingCbp,
    originCountry: "VN",
    originPort: "Hai Phong",
    portOfEntry: "NY/NJ",
    transportMode: "ocean",
    conveyance: "Maersk Ohio 27E",
    etaHours: 30,
    valueUsd: 71300,
    dutyUsd: 11200,
    incoterm: "FOB",
    entryType: "01 — Consumption",
    events: [
      { type: "entry_filed", actor: "ai", title: "Filed entry ENT-4465 to ACE", occurredHoursAgo: 30 },
    ],
  },
  {
    clientName: "LG Electronics USA",
    reference: "SHP-2232",
    entryNumber: "ENT-4459",
    stage: ShipmentStage.Released,
    status: ShipmentStatus.Released,
    originCountry: "CN",
    originPort: "Shenzhen (Yantian)",
    portOfEntry: "LA/Long Beach",
    transportMode: "ocean",
    conveyance: "ONE Stork 044E",
    etaHours: -6,
    valueUsd: 39400,
    dutyUsd: 2100,
    incoterm: "FOB",
    entryType: "01 — Consumption",
    events: [
      { type: "entry_filed", actor: "ai", title: "Filed entry ENT-4459 to ACE", occurredHoursAgo: 40 },
      { type: "cbp_response_received", actor: "cbp", title: "CBP released entry ENT-4459", occurredHoursAgo: 7 },
    ],
  },
  {
    clientName: "Specialized Bicycle Components",
    reference: "SHP-2229",
    entryNumber: "ENT-4455",
    stage: ShipmentStage.Released,
    status: ShipmentStatus.Released,
    originCountry: "TW",
    originPort: "Kaohsiung",
    portOfEntry: "Chicago",
    transportMode: "air",
    conveyance: "BR032",
    etaHours: -20,
    valueUsd: 118000,
    dutyUsd: 6300,
    incoterm: "CIP",
    entryType: "01 — Consumption",
    events: [
      { type: "entry_filed", actor: "ai", title: "Filed entry ENT-4455 to ACE", occurredHoursAgo: 48 },
      { type: "cbp_response_received", actor: "cbp", title: "CBP released entry ENT-4455", occurredHoursAgo: 20 },
      { type: "duty_reconciled", actor: "ai", title: "Reconciled ACH duty statement", occurredHoursAgo: 12, payload: { confidence: 0.99 } },
    ],
  },
];

// ---------------------------------------------------------------------------

const clientNames = [...new Set(seeds.map((seed) => seed.clientName))];
const clientRows = await db
  .select({ id: schema.clients.id, name: schema.clients.name })
  .from(schema.clients)
  .where(inArray(schema.clients.name, clientNames));
const clientIdByName = new Map(clientRows.map((row) => [row.name, row.id]));

const missing = clientNames.filter((name) => !clientIdByName.has(name));
if (missing.length) {
  console.error(
    `Missing clients (run seedClients first): ${missing.join(", ")}`,
  );
  process.exit(1);
}

for (const seed of seeds) {
  const clientId = clientIdByName.get(seed.clientName);
  if (!clientId) continue;

  // Fast-changing display snapshot; history lives in the events.
  const summary: Record<string, unknown> = {
    flags: seed.originCountry === "CN" ? ["Section 301"] : [],
    ...(seed.review
      ? {
          ...(["classification", "signoff"].includes(seed.review.type) && {
            hts: seed.review.proposal.value,
          }),
          ...(seed.review.noticeForm && { notice: seed.review.noticeForm }),
          htsConfidence: seed.review.confidence,
          nextAction: `Broker review: ${seed.review.proposal.label}`,
        }
      : {
          nextAction:
            seed.stage === ShipmentStage.Filed
              ? "Awaiting CBP release"
              : seed.stage === ShipmentStage.Released
                ? "Cleared"
                : "On autopilot",
        }),
  };

  const shipment = await insertShipment({
    organizationId,
    userId,
    clientId,
    reference: seed.reference,
    entryNumber: seed.entryNumber ?? null,
    stage: seed.stage,
    status: seed.status,
    reviewDeadlineAt: seed.review
      ? hoursFromNow(seed.review.deadlineHours)
      : null,
    reviewType: seed.review?.type ?? null,
    summary,
    originCountry: seed.originCountry,
    originPort: seed.originPort,
    portOfEntry: seed.portOfEntry,
    transportMode: seed.transportMode,
    conveyance: seed.conveyance ?? null,
    etaAt: hoursFromNow(seed.etaHours),
    valueCents: seed.valueUsd * 100,
    dutyCents: seed.dutyUsd * 100,
    incoterm: seed.incoterm ?? null,
    entryType: seed.entryType ?? null,
  });

  // Review shipments get richer content below (documents + activity from the
  // demo overview data); the handcrafted events are for flowing shipments.
  const handcraftedEvents = seed.review ? [] : seed.events;

  for (const event of handcraftedEvents) {
    await insertShipmentEvent({
      organizationId,
      userId,
      shipmentId: shipment!.id,
      type: event.type,
      actor: event.actor,
      title: event.title,
      occurredAt: hoursFromNow(-event.occurredHoursAgo),
      payload: event.payload ?? {},
    });
  }

  const overview = REVIEW_OVERVIEW[seed.reference];

  // Documents received — one event per document. CBP forms and agent-drafted
  // responses get their own types so the file reads correctly.
  for (const doc of overview?.documents ?? []) {
    const title = doc.kind === "email" ? doc.subject : doc.name;
    const cbpForm =
      doc.kind !== "email" ? /CBP Form (28|29)/i.exec(doc.name) : null;
    const isDraftResponse =
      doc.kind !== "email" && /^draft response/i.test(doc.name);

    await insertShipmentEvent({
      organizationId,
      userId,
      shipmentId: shipment!.id,
      type: cbpForm
        ? "cbp_notice_received"
        : isDraftResponse
          ? "response_drafted"
          : "document_received",
      actor: cbpForm ? "cbp" : isDraftResponse ? "ai" : "system",
      title,
      occurredAt: hoursFromNow(-doc.receivedHoursAgo),
      payload: {
        ...doc,
        ...(cbpForm && { form: `CF-${cbpForm[1]}`, posture: "proposed" }),
      },
    });
  }

  // Activity milestones (AI actions, emails sent, status changes).
  for (const activity of overview?.events ?? []) {
    await insertShipmentEvent({
      organizationId,
      userId,
      shipmentId: shipment!.id,
      type: "activity",
      actor: activity.icon === "check" ? "system" : "ai",
      title: activity.title,
      occurredAt: hoursFromNow(-activity.occurredHoursAgo),
      payload: {
        ...(activity.detail && { detail: activity.detail }),
        ...(activity.steps && { steps: activity.steps }),
        ...(activity.status && { status: activity.status }),
        icon: activity.icon,
      },
    });
  }

  if (seed.review) {
    // The full agent trace, one append-only event per step, ending shortly
    // before the review request goes out.
    const trace = REVIEW_TRACES[seed.reference] ?? [];
    const steps = trace.flatMap((phase) =>
      phase.steps.map((step) => ({ phase: phase.label, ...step })),
    );

    // Structured shipment facts, extracted once with their sources — the
    // contemporaneous-record best practice.
    await insertShipmentEvent({
      organizationId,
      userId,
      shipmentId: shipment!.id,
      type: "shipment_facts_extracted",
      actor: "ai",
      title: "Extracted shipment facts from entry documents",
      occurredAt: hoursFromNow(-1.5 - (steps.length + 1) * 0.25),
      payload: {
        facts: {
          originCountry: seed.originCountry,
          originPort: seed.originPort,
          portOfEntry: seed.portOfEntry,
          transportMode: seed.transportMode,
          conveyance: seed.conveyance ?? null,
          incoterm: seed.incoterm ?? null,
          entryType: seed.entryType ?? null,
          valueUsd: seed.valueUsd,
        },
        sources: [
          {
            fact: "value, incoterm",
            source: `Commercial invoice INV-${seed.reference.slice(-4)}`,
          },
          { fact: "route, conveyance", source: "Bill of lading" },
          { fact: "origin", source: "Manufacturer declaration" },
        ],
      },
    });

    for (const [index, step] of steps.entries()) {
      await insertShipmentEvent({
        organizationId,
        userId,
        shipmentId: shipment!.id,
        type: "agent_trace",
        actor: "ai",
        title: step.title,
        occurredAt: hoursFromNow(-1.25 - (steps.length - index) * 0.25),
        payload: {
          phase: step.phase,
          kind: step.kind,
          detail: step.detail,
          ...(step.data && { data: step.data }),
          ...(step.citationRef && { citationRef: step.citationRef }),
          step: index,
        },
      });
    }

    await insertShipmentEvent({
      organizationId,
      userId,
      shipmentId: shipment!.id,
      type: "review_requested",
      actor: "ai",
      title: seed.review.question,
      occurredAt: hoursFromNow(-1),
      payload: {
        reviewType: seed.review.type,
        question: seed.review.question,
        confidence: seed.review.confidence,
        deadlineAt: hoursFromNow(seed.review.deadlineHours).toISOString(),
        deadlineReason: seed.review.deadlineReason,
        ...(seed.review.noticeForm && { noticeForm: seed.review.noticeForm }),
        proposal: seed.review.proposal,
        ...(seed.review.dutyImpact && { dutyImpact: seed.review.dutyImpact }),
        citations: overview?.citations ?? [],
        approveLabel: overview?.approveLabel ?? "Approve",
        canRequestInfo: overview?.canRequestInfo ?? false,
        ...(overview?.alternates && { alternates: overview.alternates }),
        ...(overview?.comparison && { comparison: overview.comparison }),
      },
    });
  }

  console.log(
    `seeded: ${seed.reference} (${seed.clientName}) — ${seed.stage}/${seed.status}`,
  );
}

console.log(`\nDone — ${seeds.length} shipments seeded for org ${organizationId}`);
process.exit(0);
