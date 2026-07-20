import { keepPreviousData } from "@tanstack/react-query";
import type { ListShipmentsResponseDtoDataItem as ApiShipment } from "#/generated/api";
import {
  useShipmentEventsControllerFindAll,
  useShipmentsControllerFindAll,
} from "#/generated/api";
import { countryName } from "#/lib/countries";
import { capitalize } from "#/lib/format";
import type { ReviewSearch } from "#/lib/review-queue-loader";
import { reviewListParams } from "#/lib/review-queue-loader";
import type {
  Citation,
  PgaAgencyDetermination,
  ReviewItem,
  ReviewItemType,
  ReviewLineItem,
  ShipmentFacts,
} from "#/lib/review-types";

/* -------------------------------------------------------------------------------------------------
 * Live data — shipments in needs_review; everything the detail renders comes
 * from the review_requested payload and the shipment's event stream.
 * -----------------------------------------------------------------------------------------------*/
export interface ReviewRequestPayload {
  reviewType?: ReviewItemType;
  question?: string;
  confidence?: number;
  deadlineReason?: string;
  noticeForm?: ReviewItem["noticeForm"];
  proposal?: ReviewItem["proposal"];
  dutyImpact?: ReviewItem["dutyImpact"];
  alternates?: ReviewItem["alternates"];
  comparison?: ReviewItem["comparison"];
  citations?: Citation[];
  approveLabel?: string;
  canRequestInfo?: boolean;
  lineItems?: ReviewLineItem[];
  lineNumber?: number;
  traceRunId?: string;
  pgaAgencies?: PgaAgencyDetermination[];
  flagTableVersion?: ReviewItem["flagTableVersion"];
}

/** The display-ready shipment facts, from any shipment DTO carrying the
 * logistics columns (the list and find-one responses both do). */
export function toShipmentFacts(
  shipment: Pick<
    ApiShipment,
    | "conveyance"
    | "entryType"
    | "etaAt"
    | "incoterm"
    | "originCountry"
    | "originPort"
    | "portOfEntry"
    | "transportMode"
  >,
): ShipmentFacts {
  return {
    arrivesInHours: shipment.etaAt
      ? (new Date(shipment.etaAt).getTime() - Date.now()) / 3_600_000
      : null,
    conveyance: shipment.conveyance ?? null,
    entryType: shipment.entryType ?? "—",
    incoterm: shipment.incoterm ?? "—",
    mode: capitalize(shipment.transportMode),
    origin: shipment.originPort
      ? `${countryName(shipment.originCountry)} (${shipment.originPort})`
      : countryName(shipment.originCountry),
    originCountry: shipment.originCountry,
    port: shipment.portOfEntry,
    transportMode: shipment.transportMode,
  };
}

export function toReviewItem(
  shipment: ApiShipment,
  payload: ReviewRequestPayload,
): ReviewItem {
  const clientName = shipment.client?.name ?? "Unknown client";

  return {
    alternates: payload.alternates,
    approveLabel: payload.approveLabel ?? "Approve",
    canRequestInfo: payload.canRequestInfo,
    citations: payload.citations ?? [],
    client: clientName,
    comparison: payload.comparison,
    confidence: payload.confidence ?? 0.8,
    deadlineHoursFromNow: shipment.reviewDeadlineAt
      ? (new Date(shipment.reviewDeadlineAt).getTime() - Date.now()) / 3_600_000
      : 24,
    deadlineReason: payload.deadlineReason,
    noticeForm: payload.noticeForm,
    dutyImpact: payload.dutyImpact,
    // Documents, activity, and trace come from the shipment's event stream —
    // filled in for the selected item in ReviewQueue.
    documents: [],
    events: [],
    id: shipment.id,
    logo: shipment.client?.image ?? undefined,
    proposal: payload.proposal ?? { detail: "", label: "Proposal", value: "—" },
    question: payload.question ?? "Review required",
    reference: shipment.reference,
    shipment: toShipmentFacts(shipment),
    shipmentValue: shipment.valueCents / 100,
    traceRunId: payload.traceRunId,
    lineItems: payload.lineItems,
    reviewLineNumber: payload.lineNumber,
    type: payload.reviewType ?? "classification",
    pgaAgencies: payload.pgaAgencies,
    flagTableVersion: payload.flagTableVersion,
  };
}

export function useLiveReviewItems(search: ReviewSearch) {
  const {
    data: shipmentsResponse,
    isFetching,
    isPending,
  } = useShipmentsControllerFindAll(reviewListParams(search), {
    // Poll so freshly-flagged shipments join the queue without a refresh.
    query: { placeholderData: keepPreviousData, refetchInterval: 10_000 },
  });
  const { data: reviewEventsResponse } = useShipmentEventsControllerFindAll(
    {
      limit: 200,
      type: ["review_requested"],
    },
    { query: { refetchInterval: 10_000 } },
  );

  const shipments = shipmentsResponse?.data.data ?? [];
  const reviewEvents = reviewEventsResponse?.data.data ?? [];

  // Events arrive occurredAt desc; first hit per shipment is the latest.
  const latestPayload = new Map<string, ReviewRequestPayload>();

  for (const event of reviewEvents) {
    if (!latestPayload.has(event.shipmentId)) {
      latestPayload.set(event.shipmentId, event.payload);
    }
  }

  const items = shipments.map((shipment) =>
    toReviewItem(shipment, latestPayload.get(shipment.id) ?? {}),
  );

  const deadlines = new Map(
    shipments.flatMap((shipment) =>
      shipment.reviewDeadlineAt
        ? [[shipment.id, new Date(shipment.reviewDeadlineAt)] as const]
        : [],
    ),
  );

  return { deadlines, isFetching, isPending, items };
}
