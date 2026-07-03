import type { ReviewItemType } from "./review-queue";
import { reviewItems } from "./review-queue";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/
export type PipelineStage =
	| "intake"
	| "classification"
	| "compliance"
	| "entry"
	| "filed"
	| "released";

export interface Shipment {
	id: string;
	reference: string;
	client: string;
	/** Short origin port, e.g. "Shanghai". */
	origin: string;
	/** US port of entry. */
	port: string;
	mode: string;
	stage: PipelineStage;
	/** Hours until arrival; negative = already arrived. */
	arrivesInHours: number;
	value: number;
	duty: number;
	/** Reference matches a Review Queue item — blocked until that item is resolved. */
	fromReview?: boolean;
}

export const pipelineStages = [
	{ id: "intake", label: "Intake" },
	{ id: "classification", label: "Classification" },
	{ id: "compliance", label: "Compliance" },
	{ id: "entry", label: "Entry Prep" },
	{ id: "filed", label: "Filed" },
] as const;

/* -------------------------------------------------------------------------------------------------
 * Shipments — blocked ones derive from the Review Queue so the two pages stay in sync
 * -----------------------------------------------------------------------------------------------*/
const stageForReviewType: Record<ReviewItemType, PipelineStage> = {
	classification: "classification",
	document: "intake",
	pga: "compliance",
	signoff: "entry",
	valuation: "compliance",
};

const reviewShipments: Shipment[] = reviewItems.map((item) => ({
	arrivesInHours: item.shipment.arrivesInHours,
	client: item.client,
	duty: Math.max(100, Math.round((item.shipmentValue * 0.05) / 100) * 100),
	fromReview: true,
	id: item.reference,
	mode: item.shipment.mode,
	origin:
		item.shipment.origin.match(/\(([^)]+)\)/)?.[1] ?? item.shipment.origin,
	port: item.shipment.port,
	reference: item.reference,
	stage: stageForReviewType[item.type],
	value: item.shipmentValue,
}));

const flowingShipments: Shipment[] = [
	{
		arrivesInHours: 52,
		client: "Vela Cosmetics",
		duty: 1500,
		id: "SHP-2226",
		mode: "Ocean · HMM Songdo 023E",
		origin: "Busan",
		port: "LA/Long Beach",
		reference: "SHP-2226",
		stage: "classification",
		value: 27400,
	},
	{
		arrivesInHours: 36,
		client: "Titan Tools USA",
		duty: 4800,
		id: "SHP-2228",
		mode: "Ocean · OOCL Spain 118W",
		origin: "Ningbo",
		port: "Seattle",
		reference: "SHP-2228",
		stage: "compliance",
		value: 88200,
	},
	{
		arrivesInHours: 120,
		client: "Redwood Home Goods",
		duty: 3500,
		id: "SHP-2231",
		mode: "Ocean · Wan Hai A16 067E",
		origin: "Ho Chi Minh",
		port: "Savannah",
		reference: "SHP-2231",
		stage: "intake",
		value: 63800,
	},
	{
		arrivesInHours: 20,
		client: "Crestline Sporting Goods",
		duty: 2500,
		id: "SHP-2235",
		mode: "Air · KE214",
		origin: "Taipei",
		port: "LA/Long Beach",
		reference: "SHP-2235",
		stage: "entry",
		value: 45100,
	},
	{
		arrivesInHours: 8,
		client: "Golden Gate Trading",
		duty: 8400,
		id: "ENT-4468",
		mode: "Ocean · MSC Anna 226E",
		origin: "Shanghai",
		port: "LA/Long Beach",
		reference: "ENT-4468",
		stage: "filed",
		value: 152600,
	},
	{
		arrivesInHours: 30,
		client: "Lotus Textiles",
		duty: 11200,
		id: "ENT-4465",
		mode: "Ocean · Maersk Ohio 27E",
		origin: "Haiphong",
		port: "NY/NJ",
		reference: "ENT-4465",
		stage: "filed",
		value: 71300,
	},
	{
		arrivesInHours: -6,
		client: "Aurora Lighting Co.",
		duty: 2100,
		id: "ENT-4459",
		mode: "Ocean · ONE Stork 044E",
		origin: "Shenzhen",
		port: "LA/Long Beach",
		reference: "ENT-4459",
		stage: "released",
		value: 39400,
	},
	{
		arrivesInHours: -20,
		client: "Pinnacle Components",
		duty: 6300,
		id: "ENT-4455",
		mode: "Air · BR032",
		origin: "Taipei",
		port: "Chicago",
		reference: "ENT-4455",
		stage: "released",
		value: 118000,
	},
];

export const shipments: Shipment[] = [...reviewShipments, ...flowingShipments];
