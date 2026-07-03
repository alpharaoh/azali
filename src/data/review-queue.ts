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
	evidence: { source: string; quote: string };
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
		evidence: {
			quote:
				"24 lines · declared value $186,400 · estimated duty $12,430 · no AD/CVD or PGA flags.",
			source: "Entry summary ENT-4471",
		},
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
		shipmentValue: 186400,
		type: "signoff",
	},
	{
		approveLabel: "Approve Correction",
		client: "Harbor Foods Co.",
		confidence: 0.93,
		deadlineHoursFromNow: 3,
		evidence: {
			quote:
				"Line items sum to $45,780 — printed total reads $48,250. Packing list quantities match the line items.",
			source: "Commercial invoice INV-88231, page 2",
		},
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
		evidence: {
			quote:
				"“AX5400 tri-band wireless mesh Wi-Fi 6 router, 2-pack, model RBK762”",
			source: "Commercial invoice, line 3",
		},
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
		shipmentValue: 128000,
		type: "classification",
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
		evidence: {
			quote:
				"“Women's single-breasted blazer — shell 55% wool / 45% polyester, lining 100% polyester”",
			source: "Product spec sheet, style SA-2241",
		},
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
		shipmentValue: 64200,
		type: "classification",
	},
	{
		approveLabel: "Approve FDA Filing",
		canRequestInfo: true,
		client: "Juniper Beauty Labs",
		confidence: 0.74,
		deadlineHoursFromNow: 30,
		evidence: {
			quote:
				"“LED light therapy facial mask — red & blue light modes for skin rejuvenation”",
			source: "Product listing, SKU JB-LED-01",
		},
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
		shipmentValue: 38900,
		type: "pga",
	},
	{
		approveLabel: "Accept Transaction Value",
		canRequestInfo: true,
		client: "Meridian Auto Parts",
		confidence: 0.71,
		deadlineHoursFromNow: 48,
		evidence: {
			quote:
				"Unit price $8.40 — the trailing 12-month average for the same part from unrelated sellers is $10.25 (−18%).",
			source: "Invoice INV-4471 vs. 12-month price history",
		},
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
		shipmentValue: 92400,
		type: "valuation",
	},
	{
		approveLabel: "Approve",
		client: "Summit Footwear",
		confidence: 0.91,
		deadlineHoursFromNow: 72,
		evidence: {
			quote:
				"Heading 6404 subdivided by upper material; 3 of Summit's 132 affected SKUs need manual reassignment.",
			source: "Tariff Radar — HTS mid-year revision",
		},
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
		shipmentValue: 51600,
		type: "classification",
	},
	{
		approveLabel: "Approve Origin",
		client: "Atlas Machinery Corp.",
		confidence: 0.85,
		deadlineHoursFromNow: 96,
		evidence: {
			quote:
				"Seller: Rheinwerk Präzision GmbH, Stuttgart, DE — the country-of-origin field is blank.",
			source: "Commercial invoice INV-7702 header",
		},
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
