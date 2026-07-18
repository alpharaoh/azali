import {
  useShipmentEventsControllerFindByShipment,
  useShipmentsControllerEmails,
} from "#/generated/api";
import {
  ACTIVITY_EXCLUDED_TYPES,
  BROKER_NOTE_TYPE,
  eventPlane,
  FACTS_EVENT_TYPE,
} from "#/lib/event-kinds";
import type {
  ActivityEvent,
  ReviewDocument,
  TracePhase,
  TraceStepKind,
} from "#/lib/review-types";

export interface CaseFileFacts {
  originCountry?: string;
  originPort?: string | null;
  portOfEntry?: string;
  transportMode?: string;
  conveyance?: string | null;
  incoterm?: string | null;
  entryType?: string | null;
}

export interface CaseFile {
  documents: ReviewDocument[];
  activityEvents: ActivityEvent[];
  /** Seeded/demo trace phases — real runs carry runIds instead. */
  trace: TracePhase[];
  /** The last agent run seen — the headline line's audit record. */
  traceRunId?: string;
  facts?: CaseFileFacts;
  notes: Array<{ id: string; body: string; occurredAt: string }>;
  isPending: boolean;
}

/** How often live surfaces poll while the pipeline is working a shipment.
 * Interval refetches never cancel an in-flight request, so this is safe at
 * any server latency — the next tick simply waits its turn. */
export const PROCESSING_POLL_MS = 2_000;

/**
 * The shipment's case file: one fetch of its event stream, demultiplexed by
 * event plane into documents, activity, agent traces, structured facts, and
 * broker notes — plus the shipment's inbox emails, merged into the activity
 * timeline by date. Shared by the review workspace and the shipment detail
 * page; pass `pollMs` while the pipeline is running to keep it live.
 */
export function useCaseFile(
  shipmentId: string | undefined,
  pollMs: number | false = false,
): CaseFile {
  const { data: eventsResponse, isPending } =
    useShipmentEventsControllerFindByShipment(
      shipmentId ?? "",
      { limit: 200 },
      { query: { enabled: Boolean(shipmentId), refetchInterval: pollMs } },
    );
  const { data: emailsResponse } = useShipmentsControllerEmails(
    shipmentId ?? "",
    { query: { enabled: Boolean(shipmentId), refetchInterval: pollMs } },
  );

  // API returns occurredAt desc; the record reads oldest-first.
  const events = [...(eventsResponse?.data.data ?? [])].reverse();
  const now = Date.now();
  const hoursAgo = (occurredAt: string) =>
    (now - new Date(occurredAt).getTime()) / 3_600_000;

  // Agent trace — one event per step, grouped by payload.phase. Real
  // agent runs instead carry a runId pointing at the audit record.
  const trace: TracePhase[] = [];
  let traceRunId: string | undefined;

  for (const event of events.filter((e) => eventPlane(e.type) === "trace")) {
    const payload = event.payload as {
      phase?: string;
      kind?: TraceStepKind;
      detail?: string;
      data?: string[];
      citationRef?: string;
      runId?: string;
    };
    if (typeof payload.runId === "string") {
      traceRunId = payload.runId;
      continue;
    }
    const label = payload.phase ?? "Trace";
    const step = {
      kind: payload.kind ?? ("read" as TraceStepKind),
      title: event.title,
      detail: payload.detail ?? "",
      ...(payload.data && { data: payload.data }),
      ...(payload.citationRef && { citationRef: payload.citationRef }),
    };
    const last = trace[trace.length - 1];

    if (last?.label === label) last.steps.push(step);
    else trace.push({ label, steps: [step] });
  }

  // Documents — payloads mirror the ReviewDocument shape.
  const documents: ReviewDocument[] = events
    .filter((event) => eventPlane(event.type) === "document")
    .map(
      (event) =>
        ({
          ...(event.payload as unknown as ReviewDocument),
          receivedHoursAgo: hoursAgo(event.occurredAt),
        }) as ReviewDocument,
    );

  // Generic activity rows for the timeline.
  const milestoneEvents: ActivityEvent[] = events
    .filter(
      (event) =>
        eventPlane(event.type) === "milestone" &&
        !ACTIVITY_EXCLUDED_TYPES.has(event.type),
    )
    .map((event) => {
      const payload = event.payload as {
        detail?: string;
        steps?: string[];
        status?: string;
        icon?: ActivityEvent["icon"];
        memo?: boolean;
      };

      return {
        title: event.title,
        detail: payload.detail,
        steps: payload.steps,
        occurredHoursAgo: hoursAgo(event.occurredAt),
        icon: payload.icon ?? (event.actor === "ai" ? "ai" : "check"),
        memo: payload.memo,
        status: payload.status as ActivityEvent["status"],
      };
    });

  // The shipment's inbox emails join the timeline as their own beats.
  const emailEvents: ActivityEvent[] = (emailsResponse?.data.emails ?? []).map(
    (email) => ({
      title: email.subject ?? "Email received",
      detail: `${email.fromAddress}${
        email.attachmentCount > 0
          ? ` · ${email.attachmentCount} attachment${email.attachmentCount === 1 ? "" : "s"}`
          : ""
      }`,
      body: email.bodyPlain?.trim() || undefined,
      occurredHoursAgo: hoursAgo(email.receivedAt),
      icon: "mail" as const,
    }),
  );

  // Keep the record's oldest-first convention across both sources.
  const activityEvents = [...milestoneEvents, ...emailEvents].sort(
    (a, b) => b.occurredHoursAgo - a.occurredHoursAgo,
  );

  // Structured shipment facts (latest extraction wins).
  const factsEvent = events
    .filter((event) => event.type === FACTS_EVENT_TYPE)
    .at(-1);
  const facts = factsEvent?.payload.facts as CaseFileFacts | undefined;

  // Broker notes — part of the audit record.
  const notes = events
    .filter((event) => event.type === BROKER_NOTE_TYPE)
    .map((event) => ({
      id: event.id,
      body: String((event.payload as { body?: string }).body ?? event.title),
      occurredAt: event.occurredAt,
    }));

  return {
    activityEvents,
    documents,
    facts,
    isPending,
    notes,
    trace,
    traceRunId,
  };
}
