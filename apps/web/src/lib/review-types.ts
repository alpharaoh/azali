/* -------------------------------------------------------------------------------------------------
 * Review domain display types — the shapes the review detail renders. All of
 * this data now comes from shipments + shipment_events; these types describe
 * the event payloads and derived view models.
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
      /** Editable rich-text body (TipTap JSON) for agent-drafted documents. */
      draft?: Record<string, unknown>;
      /** Public path to the real PDF — rendered beside the extracted fields. */
      src?: string;
      /** AI summary shown next to the extraction. */
      summary?: string;
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
  /** Hours until ETA; negative means already arrived, null means no ETA. */
  arrivesInHours: number | null;
  incoterm: string;
  entryType: string;
}

/** Money consequence of the decision; alternates keyed by their value. */
export interface DutyImpact {
  proposed: { rate: string; amountUsd: number; breakdown: string[] };
  alternates?: Record<string, { amountUsd: number; deltaUsd: number }>;
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
  /** The legal clock behind the deadline, in broker terms. */
  deadlineReason?: string;
  /** Set when the review answers a CBP notice — drives the red form badge. */
  noticeForm?: "CF-28" | "CF-29";
  dutyImpact?: DutyImpact;
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
