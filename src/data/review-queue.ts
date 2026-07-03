import { useSyncExternalStore } from "react";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/
export type ReviewItemType =
	| "classification"
	| "document"
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
	reference: string;
	/** The decision being asked of the broker — the list title. */
	question: string;
	/** Hours from now until the deadline, so deadlines are always in the future. */
	deadlineHoursFromNow: number;
	shipmentValue: number;
	confidence: number;
	proposal: { label: string; value: string; detail: string };
	reasoning: Array<{ label: string; body: string }>;
	shipment: ShipmentFacts;
	documents: ReviewDocument[];
	/** Side-by-side comparison when two documents disagree. */
	comparison?: {
		docA: string;
		docB: string;
		rows: Array<{ label: string; a: string; b: string }>;
	};
	alternates?: Array<{ value: string; detail: string; confidence: number }>;
	approveLabel: string;
	canRequestInfo?: boolean;
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
		id: "rev-1",
		proposal: {
			detail: "All 24 lines classified at ≥98% confidence · duty $12,430",
			label: "Ready to file",
			value: "Entry ENT-4471",
		},
		question: "Entry ready to file — needs licensed sign-off",
		reasoning: [
			{
				body: "Commercial invoice, packing list, and bill of lading reconciled with no conflicts.",
				label: "Documents reconciled",
			},
			{
				body: "All 24 line items matched catalog classifications previously approved by your team.",
				label: "Classifications matched",
			},
			{
				body: "Duty computed at $12,430 across 3 HTS chapters; no AD/CVD or PGA flags raised.",
				label: "Duty & flags checked",
			},
			{
				body: "Vessel arrives in a few hours — filing now avoids storage charges at the port.",
				label: "Deadline check",
			},
		],
		reference: "ENT-4471",
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
		id: "rev-2",
		proposal: {
			detail:
				"Use the line-item sum instead of the printed total (packing list agrees)",
			label: "Proposed declared value",
			value: "$45,780",
		},
		question: "Invoice total conflicts with line-item sum",
		reasoning: [
			{
				body: "OCR read the printed invoice total as $48,250 with high confidence.",
				label: "Extracted total",
			},
			{
				body: "Summing the 12 line items gives $45,780 — a $2,470 discrepancy.",
				label: "Cross-check failed",
			},
			{
				body: "Packing list quantities and unit prices agree with the line items, not the printed total.",
				label: "Third source agrees",
			},
			{
				body: "Declaring the higher value would overpay roughly $680 in duty; the line-item sum is defensible.",
				label: "Impact",
			},
		],
		reference: "SHP-2209",
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
		id: "rev-3",
		proposal: {
			detail: "Machines for reception/conversion/transmission of data · Free",
			label: "Proposed HTS classification",
			value: "8517.62.0090",
		},
		question: "Which HTS code applies to the AX5400 mesh router?",
		reasoning: [
			{
				body: "Attributes extracted: wireless router, data transmission and reception, consumer networking device.",
				label: "Attributes",
			},
			{
				body: "CROSS ruling NY N324089 classified a comparable mesh Wi-Fi system under 8517.62.0090.",
				label: "Precedent",
			},
			{
				body: "8517.69 covers “other” apparatus — it applies only if reception/transmission isn't the principal function; here it is.",
				label: "Alternative considered",
			},
			{
				body: "Confidence sits below your 95% auto-file threshold because the 2-pack could arguably be classified as a set.",
				label: "Why this is queued",
			},
		],
		reference: "SHP-2214",
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
		id: "rev-9",
		proposal: {
			detail:
				"File the vessel clearance with the year read as 2022; return the traveler declaration to the client as misfiled",
			label: "Proposed document handling",
			value: "Accept CBP 1300 · set aside 6059B",
		},
		question: "Two scanned CBP forms disagree — which one supports this entry?",
		reasoning: [
			{
				body: "The client emailed two scans for the yacht import: a CBP 1300 vessel clearance and a 6059B customs declaration.",
				label: "What arrived",
			},
			{
				body: "The 1300 matches this entry: yacht “Harmonie”, Simpson Bay → Culebra, ship's agent Karen Smith.",
				label: "Match check",
			},
			{
				body: "Its handwritten date reads 2020, but the CBP stamp and the voyage particulars both say 2022 — treated as a writing error.",
				label: "Internal discrepancy",
			},
			{
				body: "The 6059B is a traveler's declaration for a different person, stamped 2010 — it cannot support this transaction.",
				label: "Misfiled document",
			},
		],
		reference: "SHP-2218",
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
		id: "rev-4",
		proposal: {
			detail: "Women's suit-type jackets, of wool — 17.5% duty",
			label: "Proposed HTS classification",
			value: "6204.31.2010",
		},
		question: "Wool or synthetic? Chief-weight call on the SA-2241 blazer",
		reasoning: [
			{
				body: "The shell fabric is 55% wool by weight — wool is the chief-weight fibre.",
				label: "Chief weight",
			},
			{
				body: "Classification follows the shell, not the lining, per the Chapter 62 notes.",
				label: "Chapter note",
			},
			{
				body: "If the wool content on the final invoice differs from the spec sheet, the code flips to 6204.33 at 26.9%.",
				label: "Risk",
			},
			{
				body: "The duty difference between the two codes is $4,120 on this shipment.",
				label: "Impact",
			},
		],
		reference: "SHP-2216",
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
		id: "rev-5",
		proposal: {
			detail: "File with FDA prior notice as a general wellness device",
			label: "Proposed PGA handling",
			value: "FDA flag: applies",
		},
		question: "Does the LED facial mask need an FDA device flag?",
		reasoning: [
			{
				body: "Light-therapy claims (“skin rejuvenation”) can make this a Class II medical device under 21 CFR 878.",
				label: "Regulatory trigger",
			},
			{
				body: "Similar products have cleared as general wellness devices when no medical claims appear on the packaging.",
				label: "Precedent",
			},
			{
				body: "The listing copy is ambiguous — the packaging artwork would settle it.",
				label: "Why this is queued",
			},
			{
				body: "Filing without the FDA flag risks a refused entry and exam delays if CBP disagrees.",
				label: "Risk",
			},
		],
		reference: "SHP-2220",
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
		id: "rev-6",
		proposal: {
			detail: "Accept the related-party price with documentation on file",
			label: "Proposed valuation treatment",
			value: "Transaction value: $8.40/unit",
		},
		question: "Related-party price is 18% below market — acceptable?",
		reasoning: [
			{
				body: "The seller is the importer's parent company — a related-party transaction under 19 USC 1401a.",
				label: "Relationship",
			},
			{
				body: "The price is 18% below comparable unrelated-party imports of the same part number.",
				label: "Price test",
			},
			{
				body: "A transfer-pricing study or circumstances-of-sale documentation would support the lower value.",
				label: "What would resolve it",
			},
			{
				body: "Undervaluation findings carry penalties plus back-duties across all prior entries.",
				label: "Risk",
			},
		],
		reference: "SHP-2225",
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
		id: "rev-7",
		proposal: {
			detail: "Textile upper, rubber sole, athletic — duty unchanged",
			label: "Proposed reclassification",
			value: "6404.11.9050",
		},
		question: "Reassign trail runner TR-9 under the new 6404 split",
		reasoning: [
			{
				body: "The old code 6404.11.90 was split by upper material in the mid-year HTS revision.",
				label: "Trigger",
			},
			{
				body: "TR-9's upper is 78% textile mesh / 22% synthetic overlays — textile governs.",
				label: "Attributes",
			},
			{
				body: "129 sibling SKUs were reassigned automatically; this one queued because the overlay percentage is close to the line.",
				label: "Why this is queued",
			},
			{
				body: "The duty rate is identical either way — this is a codes-only correction.",
				label: "Impact",
			},
		],
		reference: "SHP-2230",
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
		id: "rev-8",
		proposal: {
			detail:
				"Infer Germany from the manufacturer address and 14 prior entries",
			label: "Proposed country of origin",
			value: "DE — Germany",
		},
		question: "Country of origin missing on the Atlas invoice",
		reasoning: [
			{
				body: "The origin field on the invoice is blank — it's required for entry.",
				label: "Gap",
			},
			{
				body: "The seller address, port of lading (Hamburg), and this part's 14 prior entries all point to German origin.",
				label: "Inference",
			},
			{
				body: "Germany carries no special tariffs for this code, so the stakes are low — but origin errors are still penalty events.",
				label: "Impact",
			},
		],
		reference: "SHP-2233",
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
