import { useSyncExternalStore } from "react";
import { clientLogos } from "./client-logos";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/
export type ReviewItemType =
	| "classification"
	| "document"
	| "enforcement"
	| "pga"
	| "valuation"
	| "signoff";

export interface DocumentLine {
	label: string;
	value: string;
	highlight?: boolean;
}

export type ReviewDocument =
	| {
			kind: "pdf";
			name: string;
			meta: string;
			receivedHoursAgo: number;
			lines: DocumentLine[];
			note?: string;
	  }
	| {
			kind: "email";
			from: string;
			subject: string;
			body: string;
			meta: string;
			receivedHoursAgo: number;
	  }
	| {
			kind: "scan";
			name: string;
			meta: string;
			receivedHoursAgo: number;
			/** Public path to the scanned image. */
			src: string;
			extracted: DocumentLine[];
			note?: string;
	  };

export interface ActivityEvent {
	title: string;
	detail?: string;
	/** Compact thinking lines shown under the event — what the AI actually did. */
	steps?: string[];
	occurredHoursAgo: number;
	icon: "ai" | "check" | "mail";
	status?: "current" | "default" | "success" | "warning";
}

export type TraceStepKind =
	| "calc"
	| "check"
	| "decision"
	| "flag"
	| "lookup"
	| "read";

/** One granular unit of agent work — with the actual values and findings. */
export interface TraceStep {
	kind: TraceStepKind;
	title: string;
	detail: string;
	/** Monospace evidence lines: extracted values, calculations, query results. */
	data?: string[];
	/** Reference into the item's citations. */
	citationRef?: string;
}

export interface TracePhase {
	label: string;
	steps: TraceStep[];
}

export type CitationKind = "catalog" | "evidence" | "regulation" | "ruling";

/** A formal source the AI relied on — rulings, regulations, catalog precedent. */
export interface Citation {
	kind: CitationKind;
	ref: string;
	quote: string;
	/** External source URL — rulings, eCFR, HTSUS. Internal evidence has none. */
	href?: string;
	/** Name of the item document this cites — enables the hover preview. */
	documentName?: string;
}

export interface ShipmentFacts {
	origin: string;
	port: string;
	mode: string;
	arrivesInHours: number;
	incoterm: string;
	entryType: string;
}

export interface ReviewItem {
	id: string;
	type: ReviewItemType;
	client: string;
	logo?: string;
	reference: string;
	/** The decision being asked of the broker — the list title. */
	question: string;
	/** Hours from now until the deadline, so deadlines are always in the future. */
	deadlineHoursFromNow: number;
	shipmentValue: number;
	confidence: number;
	proposal: { label: string; value: string; detail: string };
	/** The full phased agent trace — every step of work, always visible. */
	trace: TracePhase[];
	/** The sources behind the proposal — always shown, never collapsed. */
	citations: Citation[];
	shipment: ShipmentFacts;
	documents: ReviewDocument[];
	/** Non-document activity — AI actions, emails sent, status changes. */
	events?: ActivityEvent[];
	/** Side-by-side comparison when two documents disagree. */
	comparison?: {
		docA: string;
		docB: string;
		rows: Array<{ label: string; a: string; b: string }>;
	};
	alternates?: Array<{ value: string; detail: string; confidence: number }>;
	approveLabel: string;
	canRequestInfo?: boolean;
	/** Post-entry work (Form 28/29 responses) — has no live shipment in the Pipeline. */
	postEntry?: boolean;
}

/** Stable public path slug for a document name — used for the generated PDF files. */
export function docSlug(name: string) {
	return name
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export type DecisionAction = "approved" | "corrected" | "info-requested";

export interface Decision {
	action: DecisionAction;
	alternate?: string;
}

/* -------------------------------------------------------------------------------------------------
 * Seed items — ordered by deadline
 * -----------------------------------------------------------------------------------------------*/
export const reviewItems: ReviewItem[] = [
	{
		approveLabel: "Approve & File",
		client: "Pacific Rim Imports",
		logo: clientLogos["Pacific Rim Imports"],
		confidence: 0.98,
		deadlineHoursFromNow: 1.5,
		documents: [
			{
				kind: "pdf",
				lines: [
					{ label: "Entry no.", value: "AZL-2026-4471" },
					{
						label: "Importer of record",
						value: "Pacific Rim Imports · 36-4821997",
					},
					{ label: "Lines", value: "24" },
					{ label: "Declared value", value: "$186,400" },
					{ highlight: true, label: "Estimated duty", value: "$12,430" },
					{ label: "Ch. 99 measures", value: "301 List 4A · 7.5% (22 lines)" },
					{ label: "AD/CVD · PGA flags", value: "None" },
				],
				meta: "CBP 7501 draft · 4 pages",
				name: "Entry Summary Draft",
				note: "All 24 lines matched classifications your team previously approved — nothing new to decide.",
				receivedHoursAgo: 1,
			},
			{
				kind: "pdf",
				lines: [
					{ label: "Seller", value: "Shenzhen Kaida Trading Co." },
					{ label: "Buyer", value: "Pacific Rim Imports" },
					{ label: "Terms", value: "FOB Shanghai" },
					{ label: "Invoice total", value: "$186,400" },
				],
				meta: "PDF · 6 pages",
				name: "Commercial Invoice PRI-3301",
				receivedHoursAgo: 26,
			},
		],
		events: [
			{
				detail: "24 of 24 lines matched approved catalog classifications.",
				icon: "ai",
				occurredHoursAgo: 1,
				status: "current",
				steps: [
					"Invoice ↔ packing list ↔ B/L: 72 field comparisons, 0 conflicts",
					"24/24 lines matched approved catalog entries (22 exact SKU, 2 similarity ≥0.97)",
					"Duty $12,430 = Ch. 85/94/39 base + Section 301 List 4A stack (9903.88.15) · AD/CVD and PGA screens clean",
				],
				title: "AI reconciled documents & computed duty",
			},
			{
				icon: "check",
				occurredHoursAgo: 0.5,
				title: "Queued for licensed sign-off",
			},
		],
		citations: [
			{
				kind: "catalog",
				quote:
					"All 24 lines matched classifications previously approved by your team.",
				ref: "Classification Engine · 24 entries",
			},
			{
				href: "https://www.ecfr.gov/current/title-19/section-142.2",
				kind: "regulation",
				quote:
					"Entry documentation must be filed within 15 calendar days of arrival; filing before arrival avoids storage charges.",
				ref: "19 CFR §142.2",
			},
			{
				kind: "evidence",
				quote:
					"Invoice, packing list, and bill of lading agree on quantity, weight, consignee, and value — 72 of 72 field comparisons, Σ line values $186,400.00.",
				documentName: "Commercial Invoice PRI-3301",
				ref: "Docs · PRI-3301 / PL / B-L",
			},
			{
				href: "https://hts.usitc.gov/",
				kind: "regulation",
				quote:
					"Column 1 general rates for the declared subheadings: Ch. 85 0–2.6% · Ch. 94 3.9% · Ch. 39 various.",
				ref: "HTSUS Column 1 rates",
			},
			{
				href: "https://access.trade.gov/adcvd",
				kind: "regulation",
				quote:
					"No active anti-dumping or countervailing duty orders for the declared HTS/origin pairs.",
				ref: "AD/CVD case registry",
			},
			{
				href: "https://hts.usitc.gov/search?query=9903.88.15",
				kind: "regulation",
				quote:
					"Articles the product of China, as provided for in U.S. note 20(r) to this subchapter — additional duty of 7.5% (9903.88.15).",
				ref: "USTR Section 301 · List 4A",
			},
			{
				kind: "evidence",
				quote:
					"Trailing 12-month effective duty rate for this product mix: 6.5%.",
				ref: "Entry history · Pacific Rim",
			},
		],
		id: "rev-1",
		proposal: {
			detail: "All 24 lines classified at ≥98% confidence · duty $12,430",
			label: "Ready to file",
			value: "Entry ENT-4471",
		},
		question: "Entry ready to file — needs licensed sign-off",
		reference: "ENT-4471",
		trace: [
			{
				label: "Ingestion",
				steps: [
					{
						citationRef: "Docs · PRI-3301 / PL / B-L",
						data: [
							"Seller: Shenzhen Kaida Trading Co. · Buyer: Pacific Rim Imports",
							"Terms: FOB Shanghai · Currency: USD",
							"Σ 24 line values = $186,400.00 — matches printed total exactly",
						],
						detail:
							"6 pages, 24 line items · extracted 118 fields (descriptions, quantities, unit prices, totals). Lowest field confidence 0.94 — line 17 quantity — cross-confirmed against the packing list.",
						kind: "read",
						title: "Parsed Commercial Invoice PRI-3301",
					},
					{
						citationRef: "Docs · PRI-3301 / PL / B-L",
						detail:
							"Carton counts and gross weights matched invoice quantities on all 24 lines. Bill of lading consignee matches importer of record 36-4821997; port of lading Shanghai matches invoice terms.",
						kind: "read",
						title: "Parsed packing list & bill of lading",
					},
					{
						citationRef: "Docs · PRI-3301 / PL / B-L",
						detail:
							"Invoice ↔ packing list ↔ B/L agreed on quantity, weight, consignee, and value on every line. 0 conflicts found across 72 field comparisons.",
						kind: "check",
						title: "Three-way document reconciliation",
					},
				],
			},
			{
				label: "Classification",
				steps: [
					{
						citationRef: "Classification Engine · 24 entries",
						detail:
							"24 of 24 lines matched previously approved catalog entries — 22 by exact SKU, 2 by description similarity ≥ 0.97. No new classification decisions were required.",
						kind: "lookup",
						title: "Matched all 24 lines against the catalog",
					},
					{
						citationRef: "HTSUS Column 1 rates",
						detail:
							"None of the 24 subheadings were touched by the mid-year HTS revision, and no Section 301/232 changes affect these HTS/origin pairs since Pacific Rim's last entry.",
						kind: "check",
						title: "Re-validated codes against the current HTS",
					},
					{
						citationRef: "AD/CVD case registry",
						detail:
							"No anti-dumping or countervailing orders on these HTS/origin pairs. No FDA, USDA, or EPA flags — all lines are consumer goods outside PGA scope.",
						kind: "flag",
						title: "Screened AD/CVD and PGA requirements",
					},
					{
						citationRef: "USTR Section 301 · List 4A",
						data: [
							"In scope: 22 of 24 lines · $92,521 entered value",
							"Measure: 9903.88.15 (List 4A) @ 7.5% — no active exclusions match",
							"Out of scope: 2 Ch. 94 lines outside the 301 lists",
						],
						detail:
							"China origin triggers the Section 301 check. Walked each subheading through the Chapter 99 lists and the exclusion registry — List 4A applies to 22 lines; no exclusion covers them.",
						kind: "lookup",
						title: "Stacked Chapter 99 measures (Section 301)",
					},
				],
			},
			{
				label: "Duty computation",
				steps: [
					{
						data: [
							"Ch. 85 (14 lines): $102,300 @ 0–2.6% = $1,890.40",
							"Ch. 94 (7 lines): $61,200 @ 3.9% = $2,386.80",
							"Ch. 39 (3 lines): $22,900 @ 5.3% = $1,213.70",
							"Ch. 99 · 301 List 4A (9903.88.15): 7.5% × $92,521 = $6,939.10",
							"Total estimated duty: $12,430.00 (MPF/HMF itemized separately)",
						],
						citationRef: "HTSUS Column 1 rates",
						detail:
							"Computed line by line across 3 HTS chapters, then stacked the Section 301 surcharge on the in-scope lines.",
						kind: "calc",
						title: "Computed duties",
					},
					{
						citationRef: "Entry history · Pacific Rim",
						detail:
							"Effective rate 6.7% is consistent with Pacific Rim's trailing 12-month average of 6.5% for this product mix — no anomaly.",
						kind: "check",
						title: "Sanity-checked duty against client history",
					},
				],
			},
			{
				label: "Decision",
				steps: [
					{
						citationRef: "19 CFR §142.2",
						detail:
							"Vessel ETA ≈ 5 hours. Filing pre-arrival secures release on arrival and avoids port storage charges.",
						kind: "check",
						title: "Filing-window check",
					},
					{
						detail:
							"Every line sits at ≥98% confidence — above the auto-file threshold — but entry transmission always requires licensed sign-off under your firm's policy. Queued.",
						kind: "decision",
						title: "Assembled entry ENT-4471 · queued for sign-off",
					},
				],
			},
		],
		shipment: {
			arrivesInHours: 5,
			entryType: "01 — Consumption",
			incoterm: "FOB Shanghai",
			mode: "Ocean · MSC Aurora 229E",
			origin: "China (Shanghai)",
			port: "LA/Long Beach",
		},
		shipmentValue: 186400,
		type: "signoff",
	},
	{
		approveLabel: "Approve Correction",
		client: "Harbor Foods Co.",
		logo: clientLogos["Harbor Foods Co."],
		confidence: 0.93,
		deadlineHoursFromNow: 3,
		documents: [
			{
				kind: "pdf",
				lines: [
					{ label: "Line items (12)", value: "see page 1–2" },
					{ highlight: true, label: "Sum of line items", value: "$45,780" },
					{ highlight: true, label: "Total (printed)", value: "$48,250" },
					{ label: "Currency", value: "USD" },
				],
				meta: "PDF · 2 pages",
				name: "Commercial Invoice INV-88231",
				note: "The two totals disagree by $2,470 — the packing list quantities support the line-item sum.",
				receivedHoursAgo: 3,
			},
			{
				body: "Hi team — attached invoice and packing list for the Laem Chabang shipment. Please clear before the weekend if possible, we have a DC appointment Monday morning.",
				from: "ops@harborfoods.com",
				kind: "email",
				meta: "Email · 2 attachments",
				receivedHoursAgo: 3,
				subject: "SHP-2209 — docs for Savannah arrival",
			},
		],
		events: [
			{
				detail: "Printed total disagrees with the line-item sum by $2,470.",
				icon: "ai",
				occurredHoursAgo: 2,
				status: "warning",
				steps: [
					"Σ(12 line items) $45,780 ≠ printed total $48,250 (−5.1%)",
					"Ruled out freight add-ons, currency mix-up, and missing pages",
					"Packing list corroborates the line items → typo in the printed total",
				],
				title: "AI flagged a totals mismatch",
			},
		],
		citations: [
			{
				href: "https://www.ecfr.gov/current/title-19/section-141.86",
				kind: "regulation",
				quote:
					"Each invoice shall set forth an accurate and itemized statement of the purchase price of each item.",
				ref: "19 CFR §141.86(a)",
			},
			{
				kind: "evidence",
				quote:
					"Packing list quantities and unit prices agree with the 12 line items, not the printed total.",
				ref: "Packing list PL-88231",
			},
			{
				kind: "evidence",
				quote:
					"Printed TOTAL (page 2): $48,250.00 · Σ line items 1–12: $45,780.00 — the document disagrees with itself.",
				documentName: "Commercial Invoice INV-88231",
				ref: "Invoice INV-88231",
			},
			{
				kind: "evidence",
				quote:
					"Please clear before the weekend if possible, we have a DC appointment Monday morning.",
				ref: "Email · ops@harborfoods.com",
			},
		],
		id: "rev-2",
		proposal: {
			detail:
				"Use the line-item sum instead of the printed total (packing list agrees)",
			label: "Proposed declared value",
			value: "$45,780",
		},
		question: "Invoice total conflicts with line-item sum",
		reference: "SHP-2209",
		trace: [
			{
				label: "Ingestion",
				steps: [
					{
						data: [
							"12 line items · 34 fields extracted",
							"Printed TOTAL (page 2): $48,250.00 · OCR confidence 0.98",
							"Σ line items (1–12): $45,780.00",
						],
						citationRef: "Invoice INV-88231",
						detail:
							"2 pages. Every line item extracted with confidence ≥ 0.96 — the printed total itself read cleanly, so this is not an OCR error.",
						kind: "read",
						title: "Parsed Commercial Invoice INV-88231",
					},
					{
						citationRef: "Packing list PL-88231",
						detail:
							"Quantities and unit prices on PL-88231 match invoice lines 1–12 exactly — 24 of 24 field comparisons agree with the line items.",
						kind: "read",
						title: "Parsed packing list PL-88231",
					},
					{
						citationRef: "Email · ops@harborfoods.com",
						detail:
							"Client asked to clear before the weekend (DC appointment Monday). Deadline registered against the Savannah ETA.",
						kind: "read",
						title: "Read the client's intake email",
					},
				],
			},
			{
				label: "Verification",
				steps: [
					{
						data: [
							"Σ(line items) $45,780.00 ≠ printed total $48,250.00",
							"Discrepancy: −$2,470.00 (5.1% of declared value)",
						],
						citationRef: "Invoice INV-88231",
						detail: "The arithmetic cross-check failed.",
						kind: "flag",
						title: "Cross-checked totals — MISMATCH",
					},
					{
						citationRef: "Packing list PL-88231",
						detail:
							"Tested and rejected: freight/insurance add-on (CIF charges already itemized on line 12); currency mix-up (single USD column); missing page (page count complete, line numbering contiguous). The residual explanation is a typo in the printed total.",
						kind: "lookup",
						title: "Tested common causes for the gap",
					},
					{
						data: [
							"Declared @ $48,250 → est. duty $12,798",
							"Declared @ $45,780 → est. duty $12,118",
							"Δ ≈ $680 overpaid if the printed total is used",
						],
						detail: "Quantified what the wrong choice would cost.",
						kind: "calc",
						title: "Computed the duty impact of each value",
					},
				],
			},
			{
				label: "Decision",
				steps: [
					{
						citationRef: "19 CFR §141.86(a)",
						detail:
							"The regulation requires an accurate itemized statement of the purchase price — the itemization is the stronger legal evidence, and the packing list corroborates it.",
						kind: "lookup",
						title: "Checked the legal standard for declared value",
					},
					{
						detail:
							"Value discrepancies above your $500 threshold always route to a human. Proposing the line-item sum ($45,780) with the packing list as support.",
						kind: "decision",
						title: "Queued for broker decision",
					},
				],
			},
		],
		shipment: {
			arrivesInHours: 9,
			entryType: "01 — Consumption",
			incoterm: "CIF Savannah",
			mode: "Ocean · Evergreen Ever Lucid 044E",
			origin: "Thailand (Laem Chabang)",
			port: "Savannah",
		},
		shipmentValue: 45780,
		type: "document",
	},
	{
		alternates: [
			{
				confidence: 0.11,
				detail: "Other communication apparatus — 0% duty, weaker precedent fit",
				value: "8517.69.0000",
			},
		],
		approveLabel: "Approve",
		client: "Bluewave Electronics",
		logo: clientLogos["Bluewave Electronics"],
		confidence: 0.87,
		deadlineHoursFromNow: 6,
		documents: [
			{
				kind: "pdf",
				lines: [
					{ label: "Line 1", value: "USB-C cables (2m) · $6,200" },
					{ label: "Line 2", value: "Mesh extender EX-3 · $14,800" },
					{
						highlight: true,
						label: "Line 3",
						value: "AX5400 tri-band mesh router, 2-pack · $128,000",
					},
					{ label: "Country of origin", value: "Taiwan" },
				],
				meta: "PDF · 3 pages",
				name: "Commercial Invoice BW-5540",
				note: "Line 3 is the SKU in question — lines 1 and 2 matched the catalog automatically.",
				receivedHoursAgo: 7,
			},
			{
				kind: "pdf",
				lines: [
					{
						label: "Merchandise",
						value: "Mesh Wi-Fi system (router + satellites)",
					},
					{
						highlight: true,
						label: "Holding",
						value: "8517.62.0090 · free of duty",
					},
					{ label: "Ruling date", value: "March 2022" },
				],
				meta: "Reference · CBP rulings database",
				name: "CROSS Ruling NY N324089",
				note: "Closest precedent — a comparable consumer mesh system with the same principal function.",
				receivedHoursAgo: 7,
			},
		],
		events: [
			{
				detail: "Below the 95% auto-file threshold — queued for review.",
				icon: "ai",
				occurredHoursAgo: 6,
				status: "current",
				steps: [
					"CROSS query “mesh wi-fi router system” → 14 rulings · top match NY N324089 (0.94)",
					"Catalog precedent: Bluewave's EX-3 extender approved under the same code",
					"Rejected 8517.69 (posterior 0.11) · GRI set question caps confidence at 87%",
				],
				title: "AI proposed 8517.62.0090 at 87%",
			},
		],
		citations: [
			{
				href: "https://rulings.cbp.gov/ruling/N324089",
				kind: "ruling",
				quote:
					"A mesh Wi-Fi system comprising a router and satellite units is classified under subheading 8517.62.00, free of duty.",
				ref: "CROSS NY N324089",
			},
			{
				href: "https://hts.usitc.gov/search?query=8517",
				kind: "regulation",
				quote:
					"Heading 8517 covers machines for the reception, conversion and transmission of voice, images or other data.",
				ref: "HTSUS Heading 8517",
			},
			{
				kind: "catalog",
				quote:
					"Mesh extender EX-3 approved under 8517.62.0090 for Bluewave in March — same principal function.",
				ref: "Catalog · BW-EXT-003",
			},
			{
				kind: "evidence",
				quote:
					"AX5400 tri-band wireless mesh Wi-Fi 6 router, 2-pack, model RBK762 — $128,000 · origin Taiwan.",
				documentName: "Commercial Invoice BW-5540",
				ref: "Invoice BW-5540 · line 3",
			},
			{
				href: "https://hts.usitc.gov/",
				kind: "regulation",
				quote:
					"Goods put up in sets for retail sale shall be classified by the component which gives them their essential character.",
				ref: "GRI 3(b)",
			},
			{
				href: "https://hts.usitc.gov/search?query=9903.88",
				kind: "regulation",
				quote:
					"Section 301 additional duties apply to products of China — Taiwan-origin goods fall outside the lists.",
				ref: "HTSUS Ch. 99, Subch. III",
			},
		],
		id: "rev-3",
		proposal: {
			detail: "Machines for reception/conversion/transmission of data · Free",
			label: "Proposed HTS classification",
			value: "8517.62.0090",
		},
		question: "Which HTS code applies to the AX5400 mesh router?",
		reference: "SHP-2214",
		trace: [
			{
				label: "Ingestion",
				steps: [
					{
						data: [
							"“AX5400 tri-band wireless mesh Wi-Fi 6 router, 2-pack, model RBK762”",
							"Line value: $128,000.00 · Country of origin: Taiwan",
						],
						citationRef: "Invoice BW-5540 · line 3",
						detail:
							"Lines 1 and 2 (cables, extender) matched the catalog automatically — only line 3 required classification.",
						kind: "read",
						title: "Parsed invoice line 3",
					},
					{
						citationRef: "Invoice BW-5540 · line 3",
						detail:
							"Attributes extracted: wireless router · data transmission and reception · consumer networking · sold as a 2-pack (router + satellite unit) · Wi-Fi 6 / tri-band.",
						kind: "lookup",
						title: "Extracted product attributes",
					},
				],
			},
			{
				label: "Research",
				steps: [
					{
						citationRef: "Catalog · BW-EXT-003",
						detail:
							"No exact SKU match. Closest precedent: Bluewave's mesh extender EX-3, approved under 8517.62.0090 in March — same principal function, same client.",
						kind: "lookup",
						title: "Searched the classification catalog",
					},
					{
						citationRef: "CROSS NY N324089",
						data: [
							"Query: “mesh wi-fi router system” → 14 rulings returned",
							"Top match: NY N324089 · similarity 0.94",
							"Holding: mesh system (router + satellites) → 8517.62.00, free",
						],
						detail: "Direct CBP precedent for the product configuration.",
						kind: "lookup",
						title: "Queried the CROSS rulings database",
					},
					{
						citationRef: "HTSUS Heading 8517",
						detail:
							"Heading 8517 covers machines for reception, conversion, and transmission of data — the principal-function test governs which subheading applies.",
						kind: "read",
						title: "Read the heading terms",
					},
					{
						citationRef: "HTSUS Heading 8517",
						detail:
							"8517.69 (“other apparatus”) applies only where transmission/reception is not the principal function. For a router it plainly is. Posterior for 8517.69: 0.11 — rejected but surfaced as the alternate.",
						kind: "check",
						title: "Considered and rejected 8517.69",
					},
					{
						citationRef: "HTSUS Ch. 99, Subch. III",
						detail:
							"Origin Taiwan — outside the Section 301 China lists, and no Section 232 or other Chapter 99 measure reaches 8517.62. No surcharge stacks on this entry.",
						kind: "check",
						title: "Checked Chapter 99 exposure — none",
					},
				],
			},
			{
				label: "Verification & decision",
				steps: [
					{
						citationRef: "GRI 3(b)",
						detail:
							"The 2-pack could arguably be a GRI 3(b) set. Both components classify identically, so the outcome doesn't change — but the unresolved framing question caps confidence below your threshold.",
						kind: "check",
						title: "GRI set analysis on the 2-pack",
					},
					{
						citationRef: "HTSUS Heading 8517",
						data: [
							"8517.62.0090: Free → $0 duty",
							"8517.69.0000: Free → $0 duty",
							"Rate identical either way — the risk is precedent accuracy, not money",
						],
						detail: "Duty is unaffected by the choice.",
						kind: "calc",
						title: "Computed duty under both codes",
					},
					{
						detail:
							"Proposed 8517.62.0090 at 87% — below the 95% auto-file threshold solely because of the set question. Queued with the alternate attached.",
						kind: "decision",
						title: "Proposal queued for review",
					},
				],
			},
		],
		shipment: {
			arrivesInHours: 18,
			entryType: "01 — Consumption",
			incoterm: "FOB Kaohsiung",
			mode: "Ocean · ONE Falcon 077W",
			origin: "Taiwan (Kaohsiung)",
			port: "LA/Long Beach",
		},
		shipmentValue: 128000,
		type: "classification",
	},
	{
		approveLabel: "Accept CBP 1300",
		canRequestInfo: true,
		client: "Windward Marine Group",
		logo: clientLogos["Windward Marine Group"],
		comparison: {
			docA: "Vessel Clearance (CBP 1300)",
			docB: "Customs Declaration (6059B)",
			rows: [
				{
					a: "Vessel clearance statement",
					b: "Traveler's personal declaration",
					label: "Form type",
				},
				{
					a: "Yacht “Harmonie” · Karen Smith",
					b: "Traveler “Armstrong, Nel A.”",
					label: "Party",
				},
				{
					a: "Stamped May 1, 2022",
					b: "Stamped March 2010",
					label: "CBP stamp",
				},
				{
					a: "Yes — supports the vessel import",
					b: "No — unrelated transaction",
					label: "Belongs to this entry",
				},
			],
		},
		confidence: 0.78,
		deadlineHoursFromNow: 12,
		documents: [
			{
				extracted: [
					{ label: "Form", value: "CBP 1300 — Vessel Entrance/Clearance" },
					{ label: "Vessel", value: "“Harmonie” · 49′4″ yacht · USA flag" },
					{ label: "Built", value: "La Rochelle, France · 1996" },
					{ label: "Route", value: "Simpson Bay, SX → Culebra, PR" },
					{
						highlight: true,
						label: "Box 3 date (handwritten)",
						value: "01 MAY 2020",
					},
					{ highlight: true, label: "CBP stamp", value: "Cleared MAY 01 2022" },
				],
				kind: "scan",
				meta: "Scan · 1 page",
				name: "Vessel Entrance or Clearance Statement",
				note: "The handwritten year contradicts the CBP stamp and the April 2022 voyage dates — almost certainly a pen slip for 2022.",
				receivedHoursAgo: 4,
				src: "/mock.jpeg",
			},
			{
				extracted: [
					{ label: "Form", value: "CBP 6059B — Customs Declaration" },
					{ highlight: true, label: "Traveler", value: "Armstrong, Nel A." },
					{
						label: "Countries visited",
						value: "Germany, Kuwait, Qatar, UK",
					},
					{ highlight: true, label: "CBP stamp", value: "March 2010" },
				],
				kind: "scan",
				meta: "Scan · 1 page",
				name: "Customs Declaration (6059B)",
				note: "Different person, different trip, stamped 2010 — this doesn't belong to SHP-2218 and was likely misfiled by the client.",
				receivedHoursAgo: 4,
				src: "/mock2.jpeg",
			},
		],
		events: [
			{
				detail: "Found a date discrepancy and one unrelated form.",
				icon: "ai",
				occurredHoursAgo: 3,
				status: "warning",
				steps: [
					"CBP 1300 matches SHP-2218: vessel “Harmonie”, Simpson Bay → Culebra",
					"1300's handwritten 2020 contradicted by CBP stamp + April 2022 voyage calls",
					"6059B is a 2010 traveler declaration for a different person → misfiled",
				],
				title: "AI compared the two scans",
			},
		],
		citations: [
			{
				href: "https://www.ecfr.gov/current/title-19/section-4.61",
				kind: "regulation",
				quote:
					"Vessel entrance and clearance statements are made on CBP Form 1300.",
				ref: "19 CFR §4.61",
			},
			{
				kind: "evidence",
				quote:
					"The CBP stamp reads MAY 01 2022 and voyage particulars list April 2022 calls — contradicting the handwritten 2020.",
				documentName: "Vessel Entrance or Clearance Statement",
				ref: "Scan · CBP Form 1300",
			},
			{
				kind: "evidence",
				quote:
					"Vessel “Harmonie”, Simpson Bay → Culebra, agent Karen Smith — matches the CBP 1300 particulars line for line.",
				ref: "Booking · SHP-2218",
			},
			{
				kind: "evidence",
				quote:
					"Traveler “Armstrong, Nel A.”, countries visited Germany/Kuwait/Qatar/UK, stamped March 2010 — no overlap with this transaction.",
				documentName: "Customs Declaration (6059B)",
				ref: "Scan · CBP Form 6059B",
			},
		],
		id: "rev-9",
		proposal: {
			detail:
				"File the vessel clearance with the year read as 2022; return the traveler declaration to the client as misfiled",
			label: "Proposed document handling",
			value: "Accept CBP 1300 · set aside 6059B",
		},
		question: "Two scanned CBP forms disagree — which one supports this entry?",
		reference: "SHP-2218",
		trace: [
			{
				label: "Ingestion",
				steps: [
					{
						data: [
							"Scan 1: CBP Form 1300 — Vessel Entrance or Clearance Statement",
							"Scan 2: CBP Form 6059B — Customs Declaration (traveler)",
						],
						citationRef: "19 CFR §4.61",
						detail:
							"Two scans arrived on the client email for the yacht import. Form types identified from layout and OMB numbers; both OCR'd including handwriting.",
						kind: "read",
						title: "Classified both scanned forms",
					},
					{
						citationRef: "Booking · SHP-2218",
						data: [
							"Vessel: “Harmonie” · 49′4″ yacht · USA flag",
							"Route: Simpson Bay, SX → Culebra, PR · Agent: Karen Smith",
						],
						detail:
							"Vessel name, route, and agent all match SHP-2218's booking — this is the supporting document.",
						kind: "check",
						title: "Matched the CBP 1300 to this entry",
					},
				],
			},
			{
				label: "Verification",
				steps: [
					{
						citationRef: "Scan · CBP Form 1300",
						data: [
							"Box 3 (handwritten): 01 MAY 2020",
							"CBP stamp: MAY 01 2022 · Voyage calls: 17–24 APR 22",
							"2 of 3 date signals say 2022 → handwritten year = pen slip",
						],
						detail:
							"Internal date conflict resolved by majority evidence — the stamp is machine-applied and the voyage particulars are contemporaneous.",
						kind: "check",
						title: "Resolved the 1300's internal date conflict",
					},
					{
						citationRef: "Scan · CBP Form 6059B",
						detail:
							"Traveler “Armstrong, Nel A.”, countries visited Germany/Kuwait/Qatar/UK, stamped March 2010. No field overlaps this transaction — wrong person, wrong trip, wrong decade.",
						kind: "flag",
						title: "Ruled out the 6059B entirely",
					},
				],
			},
			{
				label: "Decision",
				steps: [
					{
						citationRef: "19 CFR §4.61",
						detail:
							"The vessel clearance statement is the correct instrument for this entry. Proposing: accept the 1300 with the year read as 2022; return the 6059B to Windward as misfiled.",
						kind: "decision",
						title: "Accept CBP 1300 · set aside 6059B",
					},
				],
			},
		],
		shipment: {
			arrivesInHours: 16,
			entryType: "01 — Consumption",
			incoterm: "As-is · Simpson Bay",
			mode: "Own keel · yacht “Harmonie”",
			origin: "Sint Maarten (Simpson Bay)",
			port: "Miami",
		},
		shipmentValue: 415000,
		type: "document",
	},
	{
		alternates: [
			{
				confidence: 0.28,
				detail: "Of synthetic fibres — 26.9% duty",
				value: "6204.33.5010",
			},
		],
		approveLabel: "Approve",
		client: "Solstice Apparel",
		logo: clientLogos["Solstice Apparel"],
		confidence: 0.82,
		deadlineHoursFromNow: 26,
		documents: [
			{
				kind: "pdf",
				lines: [
					{ label: "Style", value: "SA-2241 women's blazer" },
					{
						highlight: true,
						label: "Shell",
						value: "55% wool / 45% polyester",
					},
					{ label: "Lining", value: "100% polyester" },
					{ label: "Units", value: "3,800" },
				],
				meta: "PDF · 1 page",
				name: "Spec Sheet — Style SA-2241",
				note: "Chief weight decides the code — 55% wool puts it in 6204.31 at 17.5% instead of 26.9%.",
				receivedHoursAgo: 12,
			},
			{
				body: "Confirming shell composition is 55/45 wool-poly per the mill certificate. The final commercial invoice will match the spec sheet — certificate attached for your records.",
				from: "merch@solsticeapparel.com",
				kind: "email",
				meta: "Email · 1 attachment",
				receivedHoursAgo: 6,
				subject: "RE: SA-2241 fabric composition",
			},
		],
		events: [
			{
				detail: "Asked the merch team to confirm SA-2241's fabric composition.",
				icon: "mail",
				occurredHoursAgo: 8,
				title: "Info request sent to Solstice",
			},
			{
				detail: "Client reply matches the spec sheet — wool is chief weight.",
				icon: "ai",
				occurredHoursAgo: 5,
				status: "current",
				title: "AI confirmed the chief-weight call",
			},
		],
		citations: [
			{
				href: "https://hts.usitc.gov/search?query=6204",
				kind: "regulation",
				quote:
					"Garments are classified by the fabric of the outer shell; the chief-weight fibre of the shell governs.",
				ref: "HTSUS Ch. 62, Subheading Note 2",
			},
			{
				href: "https://rulings.cbp.gov/ruling/960950",
				kind: "ruling",
				quote:
					"A woven blazer of 55% wool and 45% polyester is classifiable under subheading 6204.31.",
				ref: "CROSS HQ 960950",
			},
			{
				kind: "evidence",
				quote:
					"Shell: 55% wool / 45% polyester · Lining: 100% polyester · 3,800 units.",
				documentName: "Spec Sheet — Style SA-2241",
				ref: "Spec sheet SA-2241",
			},
			{
				kind: "evidence",
				quote:
					"Confirming shell composition is 55/45 wool-poly per the mill certificate. The final commercial invoice will match the spec sheet.",
				ref: "Email · merch@solsticeapparel.com",
			},
			{
				href: "https://hts.usitc.gov/search?query=6204.31",
				kind: "regulation",
				quote:
					"6204.31 (of wool): 17.5% ad valorem · 6204.33 (of synthetic fibres): 26.9% ad valorem.",
				ref: "HTSUS 6204 rate lines",
			},
		],
		id: "rev-4",
		proposal: {
			detail: "Women's suit-type jackets, of wool — 17.5% duty",
			label: "Proposed HTS classification",
			value: "6204.31.2010",
		},
		question: "Wool or synthetic? Chief-weight call on the SA-2241 blazer",
		reference: "SHP-2216",
		trace: [
			{
				label: "Ingestion",
				steps: [
					{
						data: [
							"Shell: 55% wool / 45% polyester",
							"Lining: 100% polyester · Units: 3,800",
						],
						citationRef: "Spec sheet SA-2241",
						detail:
							"Fabric composition extracted from the spec sheet; the commercial invoice hasn't arrived yet, so the spec sheet is the controlling evidence for now.",
						kind: "read",
						title: "Parsed spec sheet SA-2241",
					},
					{
						citationRef: "Email · merch@solsticeapparel.com",
						detail:
							"Emailed Solstice's merch team to confirm composition; reply confirmed 55/45 wool-poly per the mill certificate and promised the invoice will match.",
						kind: "check",
						title: "Confirmed composition with the client",
					},
				],
			},
			{
				label: "Research",
				steps: [
					{
						citationRef: "HTSUS Ch. 62, Subheading Note 2",
						detail:
							"Classification follows the fabric of the outer shell, not the lining — the chief-weight fibre of the shell governs. At 55% by weight, wool is chief weight.",
						kind: "read",
						title: "Applied the chapter note",
					},
					{
						citationRef: "CROSS HQ 960950",
						detail:
							"Ruling on a 55/45 wool-polyester woven blazer confirms subheading 6204.31 (of wool) rather than 6204.33 (of synthetic fibres).",
						kind: "lookup",
						title: "Found matching CROSS precedent",
					},
				],
			},
			{
				label: "Verification & decision",
				steps: [
					{
						data: [
							"6204.31.2010 (wool): 17.5% × $64,200 = $11,235",
							"6204.33.5010 (synthetic): 26.9% × $64,200 = $17,270",
							"Δ duty at stake: $6,035 — wait on invoice? No: spec + mill cert suffice",
						],
						citationRef: "HTSUS 6204 rate lines",
						detail:
							"A 5-point composition error on the final invoice would flip the code and add ~$4,120–6,000 in duty exposure.",
						kind: "calc",
						title: "Quantified the misclassification risk",
					},
					{
						detail:
							"Marginal chief-weight calls (within 10 points of 50/50) route to a human under your thresholds even with a mill certificate. Proposing 6204.31.2010 with the synthetic code as alternate.",
						kind: "decision",
						title: "Queued — composition is close to the line",
					},
				],
			},
		],
		shipment: {
			arrivesInHours: 40,
			entryType: "01 — Consumption",
			incoterm: "FOB Haiphong",
			mode: "Ocean · Maersk Emden 24E",
			origin: "Vietnam (Haiphong)",
			port: "NY/NJ",
		},
		shipmentValue: 64200,
		type: "classification",
	},
	{
		approveLabel: "Approve FDA Filing",
		canRequestInfo: true,
		client: "Juniper Beauty Labs",
		logo: clientLogos["Juniper Beauty Labs"],
		confidence: 0.74,
		deadlineHoursFromNow: 30,
		documents: [
			{
				kind: "pdf",
				lines: [
					{ label: "Product", value: "LED facial mask · SKU JB-LED-01" },
					{
						highlight: true,
						label: "Claims",
						value: "“red & blue light for skin rejuvenation”",
					},
					{ label: "Power", value: "USB-C · 5V" },
					{ label: "Units", value: "6,500" },
				],
				meta: "PDF · 1 page",
				name: "Product Listing — JB-LED-01",
				note: "The wellness-vs-medical-device line turns on the claims printed on the packaging.",
				receivedHoursAgo: 20,
			},
			{
				body: "Packaging files attached — there are no medical claims on the retail box, only 'wellness' language. Let us know if the FDA prior notice is still needed; we can adjust artwork for the next PO if that helps.",
				from: "ops@juniperbeautylabs.com",
				kind: "email",
				meta: "Email · 1 attachment",
				receivedHoursAgo: 5,
				subject: "JB-LED-01 packaging artwork",
			},
		],
		events: [
			{
				detail: "Asked Juniper for the retail packaging artwork.",
				icon: "mail",
				occurredHoursAgo: 8,
				title: "Packaging artwork requested",
			},
		],
		citations: [
			{
				href: "https://www.ecfr.gov/current/title-21/section-878.4810",
				kind: "regulation",
				quote:
					"Light-based devices intended for medical purposes are Class II devices requiring premarket notification.",
				ref: "21 CFR §878.4810",
			},
			{
				href: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices",
				kind: "regulation",
				quote:
					"Products with claims limited to general wellness and low safety risk are not regulated as medical devices.",
				ref: "FDA General Wellness Guidance",
			},
			{
				kind: "evidence",
				quote:
					"“LED light therapy facial mask — red & blue light modes for skin rejuvenation” — the claim language on the listing.",
				documentName: "Product Listing — JB-LED-01",
				ref: "Listing · JB-LED-01",
			},
			{
				kind: "evidence",
				quote:
					"There are no medical claims on the retail box, only 'wellness' language.",
				ref: "Email · ops@juniperbeautylabs.com",
			},
		],
		id: "rev-5",
		proposal: {
			detail: "File with FDA prior notice as a general wellness device",
			label: "Proposed PGA handling",
			value: "FDA flag: applies",
		},
		question: "Does the LED facial mask need an FDA device flag?",
		reference: "SHP-2220",
		trace: [
			{
				label: "Ingestion",
				steps: [
					{
						data: [
							"“LED light therapy facial mask — red & blue light modes for skin rejuvenation”",
							"Power: USB-C · 5V · Units: 6,500",
						],
						citationRef: "Listing · JB-LED-01",
						detail:
							"The claim language is the regulatory trigger — “light therapy” and “rejuvenation” both pattern-match device claims.",
						kind: "read",
						title: "Parsed the product listing",
					},
					{
						citationRef: "Email · ops@juniperbeautylabs.com",
						detail:
							"Requested the retail packaging artwork from Juniper; their reply says the box uses only “wellness” language with no medical claims — artwork attached but not yet verified against the listing.",
						kind: "check",
						title: "Requested packaging evidence from the client",
					},
				],
			},
			{
				label: "Research",
				steps: [
					{
						citationRef: "21 CFR §878.4810",
						detail:
							"Light-based devices intended for medical purposes are Class II — importation would require premarket notification and an FDA prior notice on entry.",
						kind: "lookup",
						title: "Checked the device regulation",
					},
					{
						citationRef: "FDA General Wellness Guidance",
						detail:
							"Products with claims limited to general wellness and low safety risk fall outside device regulation. Comparable LED masks have cleared both ways — the packaging claims decide it.",
						kind: "lookup",
						title: "Checked the wellness carve-out",
					},
				],
			},
			{
				label: "Decision",
				steps: [
					{
						data: [
							"With FDA flag: prior notice + possible exam · no penalty risk",
							"Without flag, if CBP disagrees: refused entry, exam delays, re-export costs",
						],
						citationRef: "21 CFR §878.4810",
						detail:
							"Asymmetric downside — over-flagging costs days; under-flagging can cost the shipment.",
						kind: "calc",
						title: "Compared the failure modes",
					},
					{
						detail:
							"Proposing to file WITH the FDA prior notice (conservative path) at 74% confidence. The packaging artwork could justify dropping the flag — a broker should make that call.",
						kind: "decision",
						title: "Queued with the conservative default",
					},
				],
			},
		],
		shipment: {
			arrivesInHours: 44,
			entryType: "01 — Consumption",
			incoterm: "FOB Busan",
			mode: "Ocean · HMM Algeciras 011E",
			origin: "South Korea (Busan)",
			port: "Seattle",
		},
		shipmentValue: 38900,
		type: "pga",
	},
	{
		approveLabel: "Accept Transaction Value",
		canRequestInfo: true,
		client: "Meridian Auto Parts",
		logo: clientLogos["Meridian Auto Parts"],
		confidence: 0.71,
		deadlineHoursFromNow: 48,
		documents: [
			{
				kind: "pdf",
				lines: [
					{ label: "Seller", value: "Meridian GmbH (parent company)" },
					{ highlight: true, label: "Unit price", value: "$8.40" },
					{ label: "Quantity", value: "11,000 units" },
					{ label: "Part", value: "RW-4471 sensor housing" },
				],
				meta: "PDF · 5 pages",
				name: "Commercial Invoice INV-4471",
				note: "Related-party price sits 18% under the unrelated-seller average for the same part.",
				receivedHoursAgo: 30,
			},
			{
				kind: "pdf",
				lines: [
					{
						highlight: true,
						label: "Unrelated sellers (12-mo avg)",
						value: "$10.25/unit",
					},
					{ label: "This invoice", value: "$8.40/unit (−18%)" },
					{ label: "Prior related-party entries", value: "$8.35–8.55/unit" },
				],
				meta: "Generated by Azali · entry history",
				name: "12-Month Price Comparison",
				receivedHoursAgo: 1,
			},
		],
		events: [
			{
				detail: "Invoice price is 18% under the unrelated-seller average.",
				icon: "ai",
				occurredHoursAgo: 28,
				status: "warning",
				title: "AI flagged related-party pricing",
			},
			{
				detail:
					"Continuous bond utilization hit 82% after the new tariff stack — the surety requires updated financials before renewal. Renewal packet drafted.",
				icon: "check",
				occurredHoursAgo: 12,
				status: "warning",
				title: "Surety flagged bond utilization",
			},
		],
		citations: [
			{
				href: "https://www.law.cornell.edu/uscode/text/19/1401a",
				kind: "regulation",
				quote:
					"Transaction value between related persons is acceptable where circumstances of sale indicate the relationship did not influence the price.",
				ref: "19 USC §1401a(b)(2)(B)",
			},
			{
				kind: "evidence",
				quote:
					"Prior related-party entries for this part ran $8.35–8.55/unit and were accepted at liquidation.",
				documentName: "12-Month Price Comparison",
				ref: "Entry history · RW-4471",
			},
			{
				kind: "evidence",
				quote:
					"Seller: Meridian GmbH (parent company) · $8.40/unit × 11,000 units = $92,400.",
				documentName: "Commercial Invoice INV-4471",
				ref: "Invoice INV-4471",
			},
			{
				href: "https://www.law.cornell.edu/uscode/text/19/1592",
				kind: "regulation",
				quote:
					"Penalties for entry of merchandise by fraud, gross negligence, or negligence — exposure reaches prior entries at the same price.",
				ref: "19 USC §1592",
			},
		],
		id: "rev-6",
		proposal: {
			detail: "Accept the related-party price with documentation on file",
			label: "Proposed valuation treatment",
			value: "Transaction value: $8.40/unit",
		},
		question: "Related-party price is 18% below market — acceptable?",
		reference: "SHP-2225",
		trace: [
			{
				label: "Ingestion",
				steps: [
					{
						data: [
							"Seller: Meridian GmbH (parent company) · related party",
							"Unit price: $8.40 × 11,000 units = $92,400",
						],
						citationRef: "Invoice INV-4471",
						detail:
							"Corporate registry match flagged the seller as the importer's parent — this invoice is a related-party transaction under 19 USC 1401a.",
						kind: "read",
						title: "Parsed invoice INV-4471 · relationship detected",
					},
				],
			},
			{
				label: "Price testing",
				steps: [
					{
						data: [
							"Unrelated sellers, same part, trailing 12 months: avg $10.25/unit (n=7 entries)",
							"This invoice: $8.40/unit → −18.0% vs. unrelated average",
							"Prior related-party entries: $8.35–8.55/unit · all liquidated without question",
						],
						citationRef: "Entry history · RW-4471",
						detail:
							"Built the comparison set from your entry history — the price is below unrelated benchmarks but consistent with the client's own related-party history.",
						kind: "calc",
						title: "Ran the circumstances-of-sale price test",
					},
					{
						citationRef: "19 USC §1401a(b)(2)(B)",
						detail:
							"Transaction value between related persons is acceptable where circumstances of sale show the relationship didn't influence the price. Consistent historical pricing supports that — but 18% is beyond your 15% review threshold.",
						kind: "lookup",
						title: "Applied the valuation statute",
					},
				],
			},
			{
				label: "Decision",
				steps: [
					{
						data: [
							"If undervaluation found: back-duties across all prior entries + penalties (19 USC 1592)",
							"Missing evidence: transfer-pricing study or CoS documentation",
						],
						citationRef: "19 USC §1592",
						detail:
							"The exposure isn't this entry's duty — it's the retroactive liability across every prior entry at this price.",
						kind: "flag",
						title: "Sized the downside",
					},
					{
						detail:
							"Proposing to accept transaction value at 71% — supported by history and prior liquidations — but a transfer-pricing study would settle it. Request Info is wired to ask Meridian for exactly that.",
						kind: "decision",
						title: "Queued — evidence would resolve this",
					},
				],
			},
		],
		shipment: {
			arrivesInHours: 60,
			entryType: "01 — Consumption",
			incoterm: "DAP Houston",
			mode: "Ocean · Hapag-Lloyd Berlin Express",
			origin: "Germany (Hamburg)",
			port: "Houston",
		},
		shipmentValue: 92400,
		type: "valuation",
	},
	{
		approveLabel: "Approve",
		client: "Summit Footwear",
		logo: clientLogos["Summit Footwear"],
		confidence: 0.91,
		deadlineHoursFromNow: 72,
		documents: [
			{
				kind: "pdf",
				lines: [
					{
						highlight: true,
						label: "Change",
						value: "6404.11.90 split by upper material",
					},
					{ label: "Effective", value: "Current period (mid-year revision)" },
					{ label: "Summit SKUs affected", value: "132 (129 auto-reassigned)" },
				],
				meta: "Reference · USITC revision record",
				name: "HTS Revision Notice — Heading 6404",
				note: "This item came from Tariff Radar — the code split left 3 SKUs needing a manual call.",
				receivedHoursAgo: 25,
			},
			{
				kind: "pdf",
				lines: [
					{
						highlight: true,
						label: "Upper",
						value: "78% textile mesh / 22% synthetic overlays",
					},
					{ label: "Sole", value: "Rubber" },
					{ label: "Style", value: "TR-9 trail runner" },
				],
				meta: "PDF · 2 pages",
				name: "Spec — TR-9 Trail Runner",
				receivedHoursAgo: 24,
			},
		],
		events: [
			{
				detail: "129 of 132 affected SKUs were reassigned automatically.",
				icon: "ai",
				occurredHoursAgo: 25,
				status: "current",
				title: "Tariff Radar triggered a reclassification sweep",
			},
		],
		citations: [
			{
				href: "https://hts.usitc.gov/search?query=6404.11",
				kind: "regulation",
				quote:
					"Subheading 6404.11.90 is subdivided according to the constituent material of the upper.",
				ref: "USITC HTS Rev. (mid-year)",
			},
			{
				kind: "catalog",
				quote:
					"129 sibling SKUs were reassigned automatically under the new subdivision.",
				ref: "Catalog · Summit Footwear",
			},
			{
				kind: "evidence",
				quote:
					"Upper: 78% textile mesh / 22% synthetic overlays (by surface area) · rubber sole.",
				documentName: "Spec — TR-9 Trail Runner",
				ref: "Spec · TR-9",
			},
		],
		id: "rev-7",
		proposal: {
			detail: "Textile upper, rubber sole, athletic — duty unchanged",
			label: "Proposed reclassification",
			value: "6404.11.9050",
		},
		question: "Reassign trail runner TR-9 under the new 6404 split",
		reference: "SHP-2230",
		trace: [
			{
				label: "Trigger",
				steps: [
					{
						citationRef: "USITC HTS Rev. (mid-year)",
						detail:
							"Tariff Radar detected the mid-year revision splitting 6404.11.90 by upper material and launched a reclassification sweep across Summit's catalog: 132 SKUs affected.",
						kind: "flag",
						title: "HTS revision hit Summit's footwear codes",
					},
					{
						citationRef: "Catalog · Summit Footwear",
						detail:
							"129 of 132 SKUs had upper compositions far from any boundary and were reassigned automatically. Three — including TR-9 — sit close enough to a line to warrant a human look.",
						kind: "decision",
						title: "Auto-reassigned the clear cases",
					},
				],
			},
			{
				label: "Analysis",
				steps: [
					{
						data: [
							"Upper: 78% textile mesh / 22% synthetic overlays (by surface area)",
							"New split: textile-dominant → 6404.11.9050 · synthetic-dominant → sibling code",
						],
						citationRef: "Spec · TR-9",
						detail:
							"Textile governs at 78% — but overlay measurement methodology (surface area vs. weight) can shift borderline uppers, which is why this queued.",
						kind: "read",
						title: "Re-measured TR-9's upper composition",
					},
					{
						citationRef: "USITC HTS Rev. (mid-year)",
						data: [
							"Old code and new code both carry 20% duty",
							"Codes-only correction — $0 duty impact",
						],
						detail: "The stakes are record accuracy, not money.",
						kind: "calc",
						title: "Confirmed duty is unchanged",
					},
					{
						detail:
							"Proposing 6404.11.9050 at 91%. Approving teaches the engine your overlay-measurement preference for the remaining borderline SKUs.",
						kind: "decision",
						title: "Proposal queued",
					},
				],
			},
		],
		shipment: {
			arrivesInHours: 80,
			entryType: "01 — Consumption",
			incoterm: "FOB Ho Chi Minh",
			mode: "Ocean · CMA CGM Ivanhoe 0MX3E",
			origin: "Vietnam (Ho Chi Minh)",
			port: "LA/Long Beach",
		},
		shipmentValue: 51600,
		type: "classification",
	},
	{
		approveLabel: "Approve Origin",
		client: "Atlas Machinery Corp.",
		logo: clientLogos["Atlas Machinery Corp."],
		confidence: 0.85,
		deadlineHoursFromNow: 96,
		documents: [
			{
				kind: "pdf",
				lines: [
					{
						label: "Seller",
						value: "Rheinwerk Präzision GmbH, Stuttgart",
					},
					{ highlight: true, label: "Country of origin", value: "(blank)" },
					{ label: "Port of lading", value: "Hamburg" },
					{ label: "Part", value: "RW-2205 precision spindle" },
				],
				meta: "PDF · 2 pages",
				name: "Commercial Invoice INV-7702",
				note: "Origin is required for entry — every other signal on this shipment points to Germany.",
				receivedHoursAgo: 40,
			},
			{
				kind: "pdf",
				lines: [
					{
						highlight: true,
						label: "Prior entries for RW-2205",
						value: "14 · all origin DE",
					},
					{ label: "Most recent", value: "3 weeks ago" },
					{ label: "Duty impact", value: "None (no special tariffs for DE)" },
				],
				meta: "Generated by Azali · entry history",
				name: "Entry History — Part RW-2205",
				receivedHoursAgo: 1,
			},
		],
		events: [
			{
				detail: "Seller address, lading port, and 14 prior entries all agree.",
				icon: "ai",
				occurredHoursAgo: 1,
				status: "current",
				title: "AI inferred German origin",
			},
		],
		citations: [
			{
				href: "https://www.ecfr.gov/current/title-19/section-134.11",
				kind: "regulation",
				quote:
					"Every article of foreign origin imported into the United States shall be marked to indicate the country of origin.",
				ref: "19 CFR §134.11",
			},
			{
				kind: "evidence",
				quote:
					"14 prior entries for part RW-2205, all declared origin DE and accepted.",
				documentName: "Entry History — Part RW-2205",
				ref: "Entry history · RW-2205",
			},
			{
				kind: "evidence",
				quote:
					"Seller: Rheinwerk Präzision GmbH, Stuttgart · country-of-origin field blank · port of lading Hamburg.",
				documentName: "Commercial Invoice INV-7702",
				ref: "Invoice INV-7702",
			},
			{
				href: "https://hts.usitc.gov/search?query=8483.10",
				kind: "regulation",
				quote:
					"8483.10.3050: Free (column 1 general) — no Section 232/301 action for German origin.",
				ref: "HTSUS 8483.10.3050",
			},
		],
		id: "rev-8",
		proposal: {
			detail:
				"Infer Germany from the manufacturer address and 14 prior entries",
			label: "Proposed country of origin",
			value: "DE — Germany",
		},
		question: "Country of origin missing on the Atlas invoice",
		reference: "SHP-2233",
		trace: [
			{
				label: "Ingestion",
				steps: [
					{
						data: [
							"Seller: Rheinwerk Präzision GmbH, Stuttgart, DE",
							"Country of origin field: (blank)",
							"Port of lading: Hamburg",
						],
						citationRef: "Invoice INV-7702",
						detail:
							"Origin is a required entry element — the blank field blocks the entry from advancing.",
						kind: "read",
						title: "Parsed invoice INV-7702 · found the gap",
					},
				],
			},
			{
				label: "Inference",
				steps: [
					{
						citationRef: "Entry history · RW-2205",
						data: [
							"Prior entries for part RW-2205: 14 · declared origin DE on all 14",
							"Most recent: 3 weeks ago · liquidated without question",
						],
						detail:
							"Seller address, lading port, and the part's complete entry history triangulate to German origin with no contradicting signal.",
						kind: "lookup",
						title: "Triangulated origin from three signals",
					},
					{
						data: [
							"DE origin: no Section 232/301 exposure for 8483.10.3050",
							"Duty impact of the inference: $0 (Free either way)",
						],
						citationRef: "HTSUS 8483.10.3050",
						detail:
							"Low monetary stakes — but origin declarations are penalty events if wrong, so the inference still needs sign-off.",
						kind: "calc",
						title: "Checked tariff exposure for DE",
					},
				],
			},
			{
				label: "Decision",
				steps: [
					{
						citationRef: "19 CFR §134.11",
						detail:
							"Origin marking and declaration are mandatory. Proposing DE at 85%; approving also triggers a note to Atlas asking the supplier to fix the invoice template.",
						kind: "decision",
						title: "Proposed DE · queued for confirmation",
					},
				],
			},
		],
		shipment: {
			arrivesInHours: 90,
			entryType: "01 — Consumption",
			incoterm: "FOB Hamburg",
			mode: "Ocean · ACL Atlantic Sail 87W",
			origin: "Germany (Hamburg)",
			port: "NY/NJ",
		},
		shipmentValue: 143700,
		type: "document",
	},
	{
		approveLabel: "Approve Response",
		client: "Titan Tools USA",
		logo: clientLogos["Titan Tools USA"],
		confidence: 0.92,
		deadlineHoursFromNow: 130,
		documents: [
			{
				kind: "pdf",
				lines: [
					{ label: "Entry no.", value: "ENT-3979 · liquidation pending" },
					{
						highlight: true,
						label: "CBP asks",
						value: "Basis for classification under 8467.21.0030",
					},
					{ label: "Response due", value: "30 days from issue date" },
					{ label: "Port", value: "Seattle (3001)" },
				],
				meta: "Received via ACE · 1 page",
				name: "CBP Form 28 — Request for Information",
				note: "CBP is questioning a March entry's classification — the response clock is running.",
				receivedHoursAgo: 50,
			},
			{
				kind: "pdf",
				lines: [
					{ label: "Exhibit A", value: "Commercial invoice + product spec" },
					{ label: "Exhibit B", value: "CROSS NY N302876 (impact drivers)" },
					{ label: "Exhibit C", value: "Entry history · 9 prior entries" },
					{
						highlight: true,
						label: "Position",
						value: "8467.21.0030 affirmed",
					},
				],
				meta: "Generated by Azali · 6 pages + 3 exhibits",
				name: "Draft Response — Entry ENT-3979",
				receivedHoursAgo: 2,
			},
		],
		events: [
			{
				detail:
					"CBP is questioning the classification basis on a liquidation-pending entry.",
				icon: "mail",
				occurredHoursAgo: 50,
				status: "warning",
				title: "CBP Form 28 received via ACE",
			},
			{
				detail:
					"Response drafted with the ruling, product spec, and entry-history exhibits.",
				icon: "ai",
				occurredHoursAgo: 2,
				status: "current",
				steps: [
					"Pulled the full ENT-3979 entry file: invoice, spec, 7501, original decision",
					"Matched CROSS NY N302876 — cordless impact drivers → 8467.21",
					"9 prior entries, same SKU, all liquidated as entered — reasonable-care record",
				],
				title: "AI assembled the evidence package",
			},
		],
		citations: [
			{
				href: "https://www.law.cornell.edu/uscode/text/19/1509",
				kind: "regulation",
				quote:
					"CBP may examine records and request information to ascertain the correctness of any entry.",
				ref: "19 USC §1509",
			},
			{
				href: "https://rulings.cbp.gov/ruling/N302876",
				kind: "ruling",
				quote:
					"Cordless impact drivers with self-contained electric motor are classified in subheading 8467.21.",
				ref: "CROSS NY N302876",
			},
			{
				kind: "evidence",
				quote:
					"9 prior entries for this SKU under 8467.21.0030 — all liquidated as entered, no prior CBP action.",
				ref: "Entry history · Titan Tools",
			},
			{
				documentName: "CBP Form 28 — Request for Information",
				kind: "evidence",
				quote:
					"Provide the basis for classification under 8467.21.0030, including product literature and supporting documentation.",
				ref: "CBP Form 28 · ENT-3979",
			},
		],
		id: "rev-10",
		postEntry: true,
		proposal: {
			detail:
				"Affirm the entered classification with ruling, spec, and history exhibits",
			label: "Proposed response to CBP",
			value: "Affirm 8467.21.0030",
		},
		question: "CBP Form 28 challenges a prior classification — response ready",
		reference: "ENT-3979",
		trace: [
			{
				label: "Ingestion",
				steps: [
					{
						citationRef: "CBP Form 28 · ENT-3979",
						data: [
							"CBP Form 28 · Entry ENT-3979 · issued at Seattle (3001)",
							"Ask: basis for 8467.21.0030 · statutory response window: 30 days",
						],
						detail:
							"Parsed the ACE notification and registered the response deadline. Enforcement volume is up — Form 28s route straight to the queue with the clock attached.",
						kind: "read",
						title: "Parsed CBP Form 28",
					},
					{
						detail:
							"Retrieved the March entry file: commercial invoice, product spec, the filed 7501, and the original catalog classification decision with its reasoning.",
						kind: "lookup",
						title: "Pulled the entry file for ENT-3979",
					},
				],
			},
			{
				label: "Evidence assembly",
				steps: [
					{
						citationRef: "CROSS NY N302876",
						detail:
							"Directly analogous CBP ruling: cordless impact drivers with self-contained electric motors classify in 8467.21. The entered code sits squarely on precedent.",
						kind: "lookup",
						title: "Matched CROSS precedent",
					},
					{
						citationRef: "Entry history · Titan Tools",
						data: [
							"9 prior entries · same SKU · 8467.21.0030",
							"All liquidated as entered — no Form 29, no rate advance",
						],
						detail:
							"A consistent, unchallenged history is the core of the reasonable-care defense.",
						kind: "check",
						title: "Compiled the entry history",
					},
					{
						citationRef: "19 USC §1509",
						detail:
							"Drafted the response: GRI 1 analysis, product literature, the ruling cite, and history exhibits — exactly the documentation §1509 entitles CBP to demand.",
						kind: "decision",
						title: "Drafted the response package",
					},
				],
			},
			{
				label: "Decision",
				steps: [
					{
						detail:
							"Form 28 responses always require licensed sign-off before transmission — an incomplete answer invites a Form 29 rate advance and penalties.",
						kind: "flag",
						title: "Queued for broker sign-off",
					},
				],
			},
		],
		shipment: {
			arrivesInHours: -2160,
			entryType: "01 — Consumption",
			incoterm: "FOB Ningbo",
			mode: "Ocean · ONE Grus 034E (arrived)",
			origin: "China (Ningbo)",
			port: "Seattle",
		},
		shipmentValue: 74600,
		type: "enforcement",
	},
];

/* -------------------------------------------------------------------------------------------------
 * Shared store — resolved decisions, subscribable from any component (page + sidebar badge)
 * -----------------------------------------------------------------------------------------------*/
let decisions: ReadonlyMap<string, Decision> = new Map();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot() {
	return decisions;
}

function emit() {
	for (const listener of listeners) listener();
}

export function resolveReviewItem(id: string, decision: Decision) {
	const next = new Map(decisions);

	next.set(id, decision);
	decisions = next;
	emit();
}

export function undoReviewItem(id: string) {
	const next = new Map(decisions);

	next.delete(id);
	decisions = next;
	emit();
}

export function useReviewDecisions() {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function usePendingReviewCount() {
	const current = useReviewDecisions();

	return reviewItems.length - current.size;
}

/* -------------------------------------------------------------------------------------------------
 * Per-item threads — broker notes and questions to the AI, part of the audit record
 * -----------------------------------------------------------------------------------------------*/
export interface ThreadMessage {
	id: string;
	author: "ai" | "broker";
	body: string;
	/** Notes live on the Overview timeline; chat messages in the Agent Trace conversation. */
	kind: "chat" | "note";
	/** Reference into the item's citations — AI answers cite their source. */
	citationRef?: string;
}

let threads: ReadonlyMap<string, readonly ThreadMessage[]> = new Map();
const threadListeners = new Set<() => void>();

function threadSubscribe(listener: () => void) {
	threadListeners.add(listener);

	return () => {
		threadListeners.delete(listener);
	};
}

function threadSnapshot() {
	return threads;
}

export function addThreadMessage(itemId: string, message: ThreadMessage) {
	const next = new Map(threads);

	next.set(itemId, [...(next.get(itemId) ?? []), message]);
	threads = next;
	for (const listener of threadListeners) listener();
}

export function useReviewThreads() {
	return useSyncExternalStore(threadSubscribe, threadSnapshot, threadSnapshot);
}
