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
      /** Short-lived link to the first-page preview image, when available. */
      previewUrl?: string | null;
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
  icon: "ai" | "check" | "mail" | "user";
  status?: "current" | "default" | "success" | "warning";
  /** A rationale memo backs this event — renders a "View memo" action. */
  memo?: boolean;
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

/** A runner-up code for one line — same shape the drawer's picker renders. */
export interface ReviewLineAlternate {
  value: string;
  detail: string;
  confidence: number;
  /** Why this candidate scored what it did — and why it wasn't chosen. */
  reason?: string;
  /** Duty on this line under the alternate, and the change vs. the proposal. */
  amountUsd?: number;
  deltaUsd?: number;
}

/** One entry line of the shipment, as shown in the review's line table. */
export interface ReviewLineItem {
  lineItemId: string;
  lineNumber: number;
  description: string;
  quantity: number | null;
  unit?: string | null;
  valueUsd: number | null;
  htsCode: string | null;
  confidence: number | null;
  status: string;
  reused: boolean;
  /** Audit-record id (agent_runs) behind this line's classification. */
  runId?: string | null;
  /** One-paragraph rationale for this line's code. */
  summary?: string | null;
  /** Present on new payloads — the multi-line UI gates on this key. */
  duty?: {
    effectivePct: number | null;
    label: string | null;
    amountUsd: number | null;
  };
  alternates?: ReviewLineAlternate[];
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
  /** Audit-record id (agent_runs) — real runs render the trace from it. */
  traceRunId?: string;
  /** The shipment's entry lines with their classifications. */
  lineItems?: ReviewLineItem[];
  /** The line this review resolves. */
  reviewLineNumber?: number;
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
  alternates?: Array<{
    value: string;
    detail: string;
    confidence: number;
    /** Why this candidate scored what it did — and why it wasn't chosen. */
    reason?: string;
  }>;
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
  /** Multi-line reviews: the per-line substitutions behind a correction. */
  corrections?: LineCorrection[];
}

/** A staged per-line substitution, keyed for the resolve call. */
export interface LineCorrection {
  lineItemId: string;
  alternate: string;
}

/**
 * Multi-line mode: several lines, each carrying its own classification
 * detail (the `duty` key marks the enriched payload shape). Old events and
 * single-line shipments render the classic headline view.
 */
export function isMultiLineReview(item: ReviewItem): boolean {
  const lines = item.lineItems ?? [];
  return lines.length > 1 && lines.every((line) => line.duty !== undefined);
}

/**
 * Shipment-level duty totals over the lines with an ad-valorem amount,
 * honoring in-flight alternate selections. Lines whose duty can't be priced
 * (specific rates, missing value) are counted in `unpricedCount`.
 */
export function dutyTotals(
  lines: ReviewLineItem[],
  corrections: Record<string, string>,
) {
  const priced = lines.filter(
    (line) => line.duty?.amountUsd != null && line.valueUsd != null,
  );
  const amountUsd = priced.reduce((sum, line) => {
    const chosen = line.alternates?.find(
      (alt) => alt.value === corrections[line.lineItemId],
    );
    return sum + (chosen?.amountUsd ?? line.duty?.amountUsd ?? 0);
  }, 0);
  const valueUsd = priced.reduce((sum, line) => sum + (line.valueUsd ?? 0), 0);
  return {
    amountUsd,
    effectivePct: valueUsd > 0 ? (amountUsd / valueUsd) * 100 : null,
    /** Commercial value across every line, priced or not. */
    totalValueUsd: lines.reduce((sum, line) => sum + (line.valueUsd ?? 0), 0),
    unpricedCount: lines.length - priced.length,
  };
}
