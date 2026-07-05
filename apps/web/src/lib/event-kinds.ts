/**
 * Presentation grouping for shipment event types. The schema stays normalized
 * (type is an open string); this module is the single place that decides which
 * plane an event renders in. Unknown types default to "system" (hidden from
 * the curated Overview, still present in raw timelines).
 */
export type EventPlane = "document" | "milestone" | "trace" | "system";

export const DOCUMENT_EVENT_TYPES = new Set([
  "cbp_notice_received",
  "classification_memo_drafted",
  "document_received",
  "response_drafted",
  "ruling_request_drafted",
]);

export const TRACE_EVENT_TYPES = new Set(["agent_trace"]);

export const MILESTONE_EVENT_TYPES = new Set([
  "activity",
  "broker_note",
  "cbp_response_received",
  "classification_proposed",
  "duty_calculated",
  "duty_computed",
  "entry_drafted",
  "entry_filed",
  "review_requested",
  "review_resolved",
  "shipment_facts_extracted",
]);

export const BROKER_NOTE_TYPE = "broker_note";
export const FACTS_EVENT_TYPE = "shipment_facts_extracted";

/** Milestones that render as generic activity rows in the review timeline. */
export const ACTIVITY_EXCLUDED_TYPES = new Set([
  BROKER_NOTE_TYPE,
  FACTS_EVENT_TYPE,
  "review_requested",
]);

export function eventPlane(type: string): EventPlane {
  if (DOCUMENT_EVENT_TYPES.has(type)) return "document";
  if (TRACE_EVENT_TYPES.has(type)) return "trace";
  if (MILESTONE_EVENT_TYPES.has(type)) return "milestone";
  return "system";
}
