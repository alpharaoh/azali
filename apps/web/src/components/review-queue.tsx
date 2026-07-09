import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRightFromSquare,
  Bell,
  Box,
  Boxes3,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDollar,
  Envelope,
  FileCheck,
  FileText,
  ListCheck,
  PaperPlane,
  Pencil,
  Person,
  Receipt,
  ShieldCheck,
  ShieldExclamation,
  Sparkles,
  Tag,
} from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Chip,
  Modal,
  ScrollShadow,
  SearchField,
  Separator,
  Skeleton,
  Spinner,
  Tabs,
  toast,
} from "@heroui/react";
import {
  ChainOfThought,
  ChatLoader,
  ChatMessage,
  ChatSource,
  ChatSources,
  HoverCard,
  PromptInput,
  PromptSuggestion,
  Segment,
  TextShimmer,
  Timeline,
  Widget,
} from "@heroui-pro/react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  addHours,
  differenceInHours,
  formatDistanceToNowStrict,
  subHours,
} from "date-fns";
import type { ComponentProps, ComponentType, ReactNode, SVGProps } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { ResponseDraftModal } from "#/components/response-draft-modal";
import { TableFetchingState } from "#/components/table-loading";
import { clientLogos } from "#/data/client-logos";
import type { ListShipmentsResponseDtoDataItem as ApiShipment } from "#/generated/api";
import {
  getShipmentEventsControllerFindByShipmentQueryKey,
  useShipmentEventsControllerCreate,
  useShipmentEventsControllerFindAll,
  useShipmentEventsControllerFindByShipment,
  useShipmentsControllerFindAll,
  useShipmentsControllerResolve,
  useShipmentsControllerStats,
} from "#/generated/api";
import { countryName } from "#/lib/countries";
import {
  ACTIVITY_EXCLUDED_TYPES,
  BROKER_NOTE_TYPE,
  eventPlane,
  FACTS_EVENT_TYPE,
} from "#/lib/event-kinds";
import type { ThreadMessage } from "#/lib/review-chat";
import { addThreadMessage, useReviewThreads } from "#/lib/review-chat";
import type { ReviewSearch } from "#/lib/review-queue-loader";
import {
  REVIEW_FILTER_GROUPS,
  reviewListParams,
} from "#/lib/review-queue-loader";
import type {
  ActivityEvent,
  Citation,
  CitationKind,
  Decision,
  DecisionAction,
  DocumentLine,
  ReviewDocument,
  ReviewItem,
  ReviewItemType,
  TracePhase,
  TraceStepKind,
} from "#/lib/review-types";
import { docSlug } from "#/lib/review-types";

/* -------------------------------------------------------------------------------------------------
 * Meta
 * -----------------------------------------------------------------------------------------------*/
const typeMeta: Record<
  ReviewItemType,
  { label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  classification: { icon: Tag, label: "Classification" },
  document: { icon: FileText, label: "Document" },
  enforcement: { icon: ShieldCheck, label: "Enforcement" },
  pga: { icon: ShieldExclamation, label: "PGA" },
  signoff: { icon: FileCheck, label: "Sign-off" },
  valuation: { icon: CircleDollar, label: "Valuation" },
};

const SEARCH_DEBOUNCE_MS = 300;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function decisionLabel(decision: Decision) {
  if (decision.action === "corrected")
    return `Corrected → ${decision.alternate}`;
  if (decision.action === "info-requested") return "Info requested";

  return "Approved";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

type DeadlineTone = "danger" | "default" | "warning";

function deadlineTone(deadline: Date): DeadlineTone {
  const hoursLeft = differenceInHours(deadline, new Date());

  return hoursLeft <= 4 ? "danger" : hoursLeft <= 24 ? "warning" : "default";
}

const deadlineTextClass: Record<DeadlineTone, string> = {
  danger: "text-danger font-medium",
  default: "text-muted",
  warning: "text-warning",
};

/* -------------------------------------------------------------------------------------------------
 * Live data — shipments in needs_review; everything the detail renders comes
 * from the review_requested payload and the shipment's event stream.
 * -----------------------------------------------------------------------------------------------*/
interface ReviewRequestPayload {
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
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toReviewItem(
  shipment: ApiShipment,
  payload: ReviewRequestPayload,
): ReviewItem {
  const arrivesInHours = shipment.etaAt
    ? (new Date(shipment.etaAt).getTime() - Date.now()) / 3_600_000
    : null;
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
    logo: shipment.client?.image ?? clientLogos[clientName],
    proposal: payload.proposal ?? { detail: "", label: "Proposal", value: "—" },
    question: payload.question ?? "Review required",
    reference: shipment.reference,
    shipment: {
      arrivesInHours,
      entryType: shipment.entryType ?? "—",
      incoterm: shipment.incoterm ?? "—",
      mode: shipment.conveyance
        ? `${capitalize(shipment.transportMode)} · ${shipment.conveyance}`
        : capitalize(shipment.transportMode),
      origin: shipment.originPort
        ? `${countryName(shipment.originCountry)} (${shipment.originPort})`
        : countryName(shipment.originCountry),
      port: shipment.portOfEntry,
    },
    shipmentValue: shipment.valueCents / 100,
    trace: [],
    type: payload.reviewType ?? "classification",
  };
}

function useLiveReviewItems(search: ReviewSearch) {
  const {
    data: shipmentsResponse,
    isFetching,
    isPending,
  } = useShipmentsControllerFindAll(reviewListParams(search), {
    query: { placeholderData: keepPreviousData },
  });
  const { data: reviewEventsResponse } = useShipmentEventsControllerFindAll({
    limit: 200,
    type: ["review_requested"],
  });

  const derived = useMemo(() => {
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

    return { deadlines, items };
  }, [shipmentsResponse, reviewEventsResponse]);

  return { ...derived, isFetching, isPending };
}

/** First-load placeholder mirroring the QueueRow layout. */
function QueueSkeleton() {
  return (
    <ul aria-label="Loading review queue" className="flex flex-col gap-0.5">
      {Array.from({ length: 5 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <li key={index} className="flex items-start gap-3 rounded-2xl p-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
            <Skeleton className="h-3.5 w-2/3 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-1/3 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Queue row — email-list-item structure: avatar · sender/time · subject · preview
 * -----------------------------------------------------------------------------------------------*/
function QueueRow({
  deadline,
  isActive,
  item,
  onSelect,
}: {
  deadline: Date;
  isActive: boolean;
  item: ReviewItem;
  onSelect: () => void;
}) {
  const tone = deadlineTone(deadline);
  const TypeIcon = typeMeta[item.type].icon;

  return (
    <li>
      <button
        aria-current={isActive ? "true" : undefined}
        className={`relative flex w-full cursor-pointer items-start gap-3 rounded-2xl p-3 text-left transition-colors ${
          isActive ? "bg-default/60" : "hover:bg-default/40"
        }`}
        type="button"
        onClick={onSelect}
      >
        <Avatar className="size-9 shrink-0">
          <Avatar.Image src={item.logo} />
          <Avatar.Fallback>{getInitials(item.client)}</Avatar.Fallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground truncate text-sm font-medium leading-tight">
              {item.client}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`whitespace-nowrap text-xs leading-tight ${deadlineTextClass[tone]}`}
              >
                {formatDistanceToNowStrict(deadline)}
              </span>
              {tone === "danger" ? (
                <span
                  aria-hidden
                  className="bg-danger size-1.5 shrink-0 rounded-full"
                />
              ) : null}
            </div>
          </div>

          <span className="text-foreground truncate text-xs font-medium leading-tight">
            {item.question}
          </span>

          <span className="text-muted truncate text-xs leading-tight">
            {item.proposal.value} — {item.proposal.detail}
          </span>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {item.noticeForm ? (
              <Chip color="danger" size="sm" variant="soft">
                <Chip.Label className="font-semibold">
                  {item.noticeForm}
                </Chip.Label>
              </Chip>
            ) : null}
            <Chip size="sm" variant="soft">
              <TypeIcon className="size-3" />
              <Chip.Label>{typeMeta[item.type].label}</Chip.Label>
            </Chip>
            <Chip size="sm" variant="soft">
              <Chip.Label className="tabular-nums">{item.reference}</Chip.Label>
            </Chip>
          </div>
        </div>
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Shipment fact + document previews
 * -----------------------------------------------------------------------------------------------*/
function receivedAgo(hoursAgo: number) {
  return formatDistanceToNowStrict(subHours(new Date(), hoursAgo), {
    addSuffix: true,
  });
}

function ShipmentFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="text-muted text-xs">{label}</span>
      <span className="text-foreground truncate text-sm font-medium">
        {value}
      </span>
    </div>
  );
}

function DocumentLineRow({ line }: { line: DocumentLine }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 rounded px-1.5 py-0.5 ${
        line.highlight ? "bg-warning/15" : ""
      }`}
    >
      <span className="text-muted shrink-0">{line.label}</span>
      <span
        className={`text-right ${
          line.highlight ? "text-foreground font-semibold" : "text-foreground"
        }`}
      >
        {line.value}
      </span>
    </div>
  );
}

/**
 * Timeline injects `_index`/`_isLast` into its direct children — forward them
 * so the connector line stops at the last node.
 */
type TimelineItemPassthrough = Partial<ComponentProps<typeof Timeline.Item>>;

/**
 * Colour + icon for a timeline marker, derived from what the event means:
 * CBP correspondence is purple, classification is blue, milestones
 * (filed/released) are green, agent work is indigo, plain mail stays neutral.
 * Documents keep their neutral markers.
 */
function eventMarker(event: ActivityEvent): {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  className: string;
} {
  if (/\bcbp\b|form 2[89]/i.test(event.title)) {
    return {
      Icon: Envelope,
      className:
        "border-purple-500/40 bg-purple-500/15 text-purple-600 dark:text-purple-400",
    };
  }
  if (event.icon === "user") {
    return {
      Icon: Person,
      className:
        "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  if (/classif/i.test(event.title)) {
    return {
      Icon: Tag,
      className:
        "border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-400",
    };
  }
  if (event.icon === "check") {
    return {
      Icon: CircleCheck,
      className:
        "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    };
  }
  if (event.icon === "ai") {
    return {
      Icon: Sparkles,
      className:
        "border-indigo-500/40 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    };
  }

  return { Icon: PaperPlane, className: "" };
}

const citationMeta: Record<
  CitationKind,
  { chip: "accent" | "default" | "success" | "warning"; label: string }
> = {
  catalog: { chip: "success", label: "Catalog" },
  evidence: { chip: "warning", label: "Evidence" },
  regulation: { chip: "default", label: "Regulation" },
  ruling: { chip: "accent", label: "CROSS Ruling" },
};

function faviconFor(href: string) {
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(href)}&sz=64`;
}

/** The hover body shared by both pill variants — kind, reference, exact passage. */
function CitationQuote({ citation }: { citation: Citation }) {
  const meta = citationMeta[citation.kind];

  return (
    <div className="flex max-w-72 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Chip color={meta.chip} size="sm" variant="soft">
          <Chip.Label>{meta.label}</Chip.Label>
        </Chip>
        <span className="text-foreground font-mono text-xs font-semibold">
          {citation.ref}
        </span>
      </div>
      <p className="text-muted m-0 text-xs leading-relaxed">
        “{citation.quote}”
      </p>
    </div>
  );
}

/**
 * The top half of the cited document inside the hover card — the real scan for
 * scans, a reconstructed sheet for PDFs. Hovering fades in "View full document",
 * which opens the file in a new tab.
 */
function DocPeek({ document: doc }: { document: ReviewDocument }) {
  if (doc.kind === "email") return null;

  const href =
    doc.kind === "scan"
      ? doc.src
      : (doc.src ?? `/docs/${docSlug(doc.name)}.pdf`);

  return (
    <a
      className="group relative block h-28 overflow-hidden border-b"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {doc.kind === "scan" ? (
        <img
          alt={doc.name}
          className="h-full w-full object-cover object-top"
          src={doc.src}
        />
      ) : (
        <div className="bg-surface flex h-full flex-col gap-1 px-3.5 py-3">
          <span className="text-foreground text-[11px] font-semibold leading-tight">
            {doc.name}
          </span>
          <span className="text-muted text-[9px]">{doc.meta}</span>
          <div className="bg-separator my-0.5 h-px" />
          {doc.lines.slice(0, 4).map((line) => (
            <div
              key={line.label}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="text-muted shrink-0 text-[9px]">
                {line.label}
              </span>
              <span className="text-foreground truncate text-[9px] font-medium">
                {line.value}
              </span>
            </div>
          ))}
        </div>
      )}
      <span className="bg-background/70 absolute inset-0 flex items-center justify-center opacity-0 backdrop-blur-[2px] transition-opacity duration-150 group-hover:opacity-100">
        <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
          <ArrowUpRightFromSquare className="size-3.5" />
          View full document
        </span>
      </span>
    </a>
  );
}

/** Resolve the document a citation points at, for the hover preview. */
function findCitedDocument(item: ReviewItem, citation: Citation) {
  if (!citation.documentName) return undefined;

  return item.documents.find(
    (doc) => doc.kind !== "email" && doc.name === citation.documentName,
  );
}

/**
 * Compact source pill — hover reveals the exact passage the agent relied on.
 * External sources (rulings, eCFR, HTSUS) get a favicon and open the real page;
 * internal evidence renders as a document pill with a peek at the document.
 */
function CitationPill({
  citation,
  document,
}: {
  citation: Citation;
  document?: ReviewDocument;
}) {
  if (citation.href) {
    return (
      <ChatSource enablePreview className="self-start" href={citation.href}>
        <ChatSource.Trigger>
          <ChatSource.Icon faviconUrl={faviconFor(citation.href)} />
          <ChatSource.Title>{citation.ref}</ChatSource.Title>
        </ChatSource.Trigger>
        <ChatSource.Preview className="p-3">
          <CitationQuote citation={citation} />
        </ChatSource.Preview>
      </ChatSource>
    );
  }

  return (
    <HoverCard closeDelay={100} openDelay={150}>
      <HoverCard.Trigger className="inline-flex w-fit max-w-full self-start">
        <ChatSource sourceType="document" title={citation.ref} />
      </HoverCard.Trigger>
      <HoverCard.Content
        className={document ? "w-72 overflow-hidden p-0" : "p-3"}
        placement="top"
      >
        {document ? <DocPeek document={document} /> : null}
        <div className={document ? "p-3" : undefined}>
          <CitationQuote citation={citation} />
        </div>
      </HoverCard.Content>
    </HoverCard>
  );
}

/** Deterministic mock "thinking time" so every trace feels like real agent work. */
function traceDuration(item: ReviewItem) {
  const steps = item.trace.reduce((sum, phase) => sum + phase.steps.length, 0);
  const seconds = steps * 19 + item.citations.length * 11;

  return seconds >= 60
    ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    : `${seconds}s`;
}

/** Canned AI reply for the item thread — cites the top source for questions. */
function aiReply(item: ReviewItem, message: string): string {
  const citation = item.citations[0];
  const kind = typeMeta[item.type].label.toLowerCase();

  if (message.trim().endsWith("?") && citation) {
    return `Good question — my proposal leans on ${citation.ref}: “${citation.quote}” If you read it differently, correct me and I'll apply your preference to future ${item.client} ${kind} decisions.`;
  }

  return `Noted — I've added this to ${item.reference}'s audit record and will factor it into future ${kind} decisions for ${item.client}.`;
}

function ThreadTimelineItem({
  message,
  time = "just now",
  ...rest
}: { message: ThreadMessage; time?: string } & TimelineItemPassthrough) {
  const isAi = message.author === "ai";
  const Icon = isAi ? Sparkles : Person;

  return (
    <Timeline.Item
      align="start"
      status={isAi ? "current" : "default"}
      {...rest}
    >
      <Timeline.Marker aria-hidden="true" className="size-6">
        <Icon className="size-3.5" />
      </Timeline.Marker>
      <Timeline.Content className="gap-0.5">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <h3 className="text-foreground m-0 text-xs font-medium leading-5">
            {isAi ? "Azali AI" : "You"}
          </h3>
          <time className="text-muted shrink-0 text-xs leading-5">{time}</time>
        </div>
        <p className="text-muted m-0 text-xs leading-5">{message.body}</p>
      </Timeline.Content>
    </Timeline.Item>
  );
}

function EventTimelineItem({
  event,
  onViewMemo,
  onViewTrace,
  ...rest
}: {
  event: ActivityEvent;
  onViewMemo?: () => void;
  onViewTrace?: () => void;
} & TimelineItemPassthrough) {
  const { Icon, className: markerClassName } = eventMarker(event);

  return (
    <Timeline.Item align="start" status={event.status ?? "default"} {...rest}>
      <Timeline.Marker
        aria-hidden="true"
        className={`size-6 ${markerClassName}`}
      >
        <Icon className="size-3.5" />
      </Timeline.Marker>
      <Timeline.Content className="gap-0.5">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h3 className="text-foreground m-0 min-w-0 truncate text-xs font-medium leading-5">
            {event.title}
          </h3>
          <time className="text-muted shrink-0 text-xs leading-5">
            {receivedAgo(event.occurredHoursAgo)}
          </time>
        </div>
        {event.detail ? (
          <p
            className="text-muted m-0 line-clamp-1 text-xs leading-5"
            title={event.detail}
          >
            {event.detail}
          </p>
        ) : null}
        {event.memo && onViewMemo ? (
          <button
            className="text-muted hover:text-foreground mt-0.5 inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs transition-colors"
            type="button"
            onClick={onViewMemo}
          >
            <FileText className="size-3" />
            View memo
            <ChevronRight className="size-3" />
          </button>
        ) : null}
        {event.steps && onViewTrace ? (
          <button
            className="text-muted hover:text-foreground mt-0.5 inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs transition-colors"
            type="button"
            onClick={onViewTrace}
          >
            <Sparkles className="size-3" />
            View agent trace
            <ChevronRight className="size-3" />
          </button>
        ) : null}
      </Timeline.Content>
    </Timeline.Item>
  );
}

function DocumentsTimelineItem({
  documents,
  onEditDraft,
  ...rest
}: {
  documents: ReviewDocument[];
  onEditDraft?: (document: ReviewDocument & { kind: "pdf" }) => void;
} & TimelineItemPassthrough) {
  return (
    <Timeline.Item align="start" status="default" {...rest}>
      <Timeline.Marker aria-hidden="true" className="size-6">
        <FileText className="text-muted size-3.5" />
      </Timeline.Marker>
      <Timeline.Content className="gap-2">
        <Tabs className="w-fit" variant="secondary">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Shipment documents" className="w-fit">
              {documents.map((document, index) => {
                const { Icon, label } = docTabMeta(document);

                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static per-shipment doc set
                  <Tabs.Tab key={index} id={`doc-${index}`} className="w-fit">
                    <Icon className="size-3.5 mr-1.5" />
                    {label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                );
              })}
            </Tabs.List>
          </Tabs.ListContainer>
          {documents.map((document, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static per-shipment doc set
            <Tabs.Panel key={index} className="pt-2" id={`doc-${index}`}>
              <DocumentBody
                document={document}
                onEditDraft={
                  document.kind === "pdf" && document.draft && onEditDraft
                    ? () =>
                        onEditDraft(
                          document as ReviewDocument & { kind: "pdf" },
                        )
                    : undefined
                }
              />
            </Tabs.Panel>
          ))}
        </Tabs>
      </Timeline.Content>
    </Timeline.Item>
  );
}

/** A standalone document beat (CBP correspondence, drafted responses). */
function SingleDocumentTimelineItem({
  document,
  onEditDraft,
  ...rest
}: {
  document: ReviewDocument;
  onEditDraft?: () => void;
} & TimelineItemPassthrough) {
  const isCbpForm =
    document.kind !== "email" && /cbp form 2[89]/i.test(document.name);
  const title = document.kind === "email" ? document.subject : document.name;

  return (
    <Timeline.Item align="start" status="default" {...rest}>
      <Timeline.Marker
        aria-hidden="true"
        className={`size-6 ${
          isCbpForm
            ? "border-purple-500/40 bg-purple-500/15 text-purple-600 dark:text-purple-400"
            : ""
        }`}
      >
        {document.kind === "email" ? (
          <Envelope className={`size-3.5 ${isCbpForm ? "" : "text-muted"}`} />
        ) : (
          <FileText className={`size-3.5 ${isCbpForm ? "" : "text-muted"}`} />
        )}
      </Timeline.Marker>
      <Timeline.Content className="gap-2">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <h3 className="text-foreground m-0 min-w-0 truncate text-xs font-medium leading-5">
            {title}
          </h3>
          <time className="text-muted shrink-0 text-xs leading-5">
            {receivedAgo(document.receivedHoursAgo)}
          </time>
        </div>
        <DocumentBody document={document} onEditDraft={onEditDraft} />
      </Timeline.Content>
    </Timeline.Item>
  );
}

/**
 * First-load placeholder for the case file: the tabbed documents item
 * (tabs bar, document pane, extraction) followed by a few event rows.
 */
function ActivitySkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading the file"
      className="flex flex-col gap-7"
      role="status"
    >
      <div className="flex gap-3">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24 rounded-lg" />
            <Skeleton className="h-7 w-28 rounded-lg" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Skeleton className="h-56 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-5/6 rounded" />
              <Skeleton className="h-3 w-2/3 rounded" />
              <Skeleton className="h-36 rounded-lg" />
              <Skeleton className="mt-1 h-8 w-32 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <div key={index} className="flex gap-3">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
            <Skeleton className="h-3.5 w-1/2 rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tab label + icon for a document, inferred from what it is. */
function docTabMeta(document: ReviewDocument): {
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
} {
  if (document.kind === "email") return { Icon: Envelope, label: "Email" };

  const name = document.name;

  if (/cbp form 28/i.test(name)) {
    return { Icon: ShieldExclamation, label: "CF-28" };
  }
  if (/cbp form 29/i.test(name)) {
    return { Icon: ShieldExclamation, label: "CF-29" };
  }
  if (/draft response|response/i.test(name)) {
    return { Icon: Pencil, label: "Response Draft" };
  }
  if (/invoice/i.test(name)) return { Icon: Receipt, label: "Invoice" };
  if (/packing/i.test(name)) return { Icon: Box, label: "Packing List" };
  if (/bill of lading|b\/l|awb/i.test(name)) {
    return { Icon: Boxes3, label: "Bill of Lading" };
  }
  if (/arrival/i.test(name)) return { Icon: Bell, label: "Arrival Notice" };
  if (/spec/i.test(name)) return { Icon: ListCheck, label: "Spec Sheet" };

  return {
    Icon: FileText,
    label: name.length > 22 ? `${name.slice(0, 22)}…` : name,
  };
}

/** One document's content — draft letter, real PDF + extraction, email, or fields. */
function DocumentBody({
  document,
  onEditDraft,
}: {
  document: ReviewDocument;
  onEditDraft?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {document.kind === "pdf" && document.draft ? (
        <DraftDocumentPreview document={document} onView={onEditDraft} />
      ) : document.kind === "email" ? (
        <>
          <span className="text-muted text-xs">
            From: {document.from} · {document.meta}
          </span>
          <p className="bg-background/40 text-foreground rounded-lg border p-3 text-xs leading-relaxed">
            {document.body}
          </p>
        </>
      ) : document.kind === "pdf" ? (
        // Real PDFs carry their own src; everything else falls back to the
        // generated file at the conventional /docs/<slug>.pdf path.
        <PdfWithExtraction
          document={{
            ...document,
            src: document.src ?? `/docs/${docSlug(document.name)}.pdf`,
          }}
        />
      ) : (
        <>
          <a
            className="block"
            href={document.src}
            rel="noreferrer"
            target="_blank"
          >
            <img
              alt={document.name}
              className="max-h-80 w-full rounded-lg border bg-white object-contain"
              src={document.src}
            />
          </a>
          <div className="bg-background/40 flex flex-col gap-0.5 rounded-lg border p-3 font-mono text-xs leading-relaxed">
            {document.extracted.map((line) => (
              <DocumentLineRow key={line.label} line={line} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Draft letter preview — the agent-drafted response rendered as a document,
 * capped and faded; the full text opens in the editor.
 * -----------------------------------------------------------------------------------------------*/
interface DraftNode {
  type?: string;
  text?: string;
  marks?: Array<{ type: string }>;
  attrs?: { level?: number };
  content?: DraftNode[];
}

function renderDraftInline(node: DraftNode, key: number): ReactNode {
  let element: ReactNode = node.text ?? "";

  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") element = <strong>{element}</strong>;
    else if (mark.type === "italic") element = <em>{element}</em>;
  }

  return <Fragment key={key}>{element}</Fragment>;
}

function renderDraftBlocks(nodes: DraftNode[]): ReactNode {
  return nodes.map((node, index) => {
    const inline = (node.content ?? []).map(renderDraftInline);

    switch (node.type) {
      case "heading":
        return (node.attrs?.level ?? 2) <= 2 ? (
          <h4
            key={index}
            className="text-foreground mt-1 text-sm font-semibold"
          >
            {inline}
          </h4>
        ) : (
          <h5
            key={index}
            className="text-foreground mt-1 text-xs font-semibold"
          >
            {inline}
          </h5>
        );
      case "bulletList":
        return (
          <ul key={index} className="flex list-disc flex-col gap-1 pl-4">
            {(node.content ?? []).map((item, itemIndex) => (
              <li key={itemIndex}>
                {(item.content?.[0]?.content ?? []).map(renderDraftInline)}
              </li>
            ))}
          </ul>
        );
      default:
        return <p key={index}>{inline}</p>;
    }
  });
}

function DraftDocumentPreview({
  document,
  onView,
}: {
  document: ReviewDocument & { kind: "pdf" };
  onView?: () => void;
}) {
  const content =
    (document.draft as { content?: DraftNode[] } | undefined)?.content ?? [];

  return (
    <div className="bg-background/40 relative max-h-80 overflow-hidden rounded-lg border">
      <div className="text-muted flex flex-col gap-2 p-4 pb-8 text-xs leading-relaxed [mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]">
        {renderDraftBlocks(content)}
      </div>
      {onView ? (
        <button
          aria-label="View full response"
          className="group absolute inset-0 cursor-pointer"
          type="button"
          onClick={onView}
        >
          <span className="bg-background/70 absolute inset-0 flex items-center justify-center opacity-0 backdrop-blur-[2px] transition-opacity duration-150 group-hover:opacity-100">
            <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
              <Pencil className="size-3.5" />
              View full response
            </span>
          </span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Inline preview of a real PDF beside what the AI extracted from it. The
 * preview is deliberately non-interactive — "View document" opens the full
 * viewer with the complete extraction.
 */
function PdfWithExtraction({
  document,
}: {
  document: ReviewDocument & { kind: "pdf"; src?: string };
}) {
  const [isViewerOpen, setViewerOpen] = useState(false);
  const [isPreviewLoaded, setPreviewLoaded] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const lines = document.lines;
  // Page count lives in the document meta ("… · 3 pages") — the preview
  // always shows page one.
  const pageCount = /(\d+)\s+pages?/i.exec(document.meta)?.[1] ?? null;
  // How many extracted-field rows the item cap clips off, measured for real
  // so the "N more fields" hint is always accurate.
  const fieldsRegionRef = useRef<HTMLDivElement>(null);
  const [hiddenFields, setHiddenFields] = useState(0);

  useEffect(() => {
    const region = fieldsRegionRef.current;
    if (!region) return;

    const update = () => {
      let hidden = 0;
      for (const row of region.querySelectorAll<HTMLElement>(
        "[data-field-row]",
      )) {
        if (row.offsetTop + row.offsetHeight > region.clientHeight) {
          hidden += 1;
        }
      }
      setHiddenFields(hidden);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(region);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* The whole item is capped: the right column dictates the height up to
          max-h-96; fields clip with a fade, the button never does. */}
      <div className="grid gap-3 lg:max-h-96 lg:grid-cols-2">
        {/* Document preview — page one rendered whole (object-contain) on a
            soft gray mat; the page count sits top-right. PNGs live next to
            each PDF in public/docs; the <object> viewer is the fallback. */}
        <div className="bg-default/40 relative flex h-full max-h-96 min-h-72 items-center justify-center overflow-hidden rounded-lg border p-1">
          {!isPreviewLoaded && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner aria-label="Loading document preview" size="sm" />
            </span>
          )}
          {previewFailed ? (
            <object
              aria-hidden
              className="pointer-events-none h-full w-full"
              data={`${document.src}#toolbar=0&navpanes=0&scrollbar=0`}
              type="application/pdf"
            />
          ) : (
            <img
              alt=""
              aria-hidden
              className={`pointer-events-none h-full max-h-full w-auto max-w-full rounded-sm bg-white object-contain shadow-sm transition-opacity duration-200 ${
                isPreviewLoaded ? "opacity-100" : "opacity-0"
              }`}
              src={document.src?.replace(/\.pdf$/i, ".png")}
              onError={() => {
                setPreviewFailed(true);
                setPreviewLoaded(true);
              }}
              onLoad={() => setPreviewLoaded(true)}
            />
          )}
          {pageCount ? (
            <span className="bg-background/80 text-muted absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums backdrop-blur-sm">
              1 of {pageCount}
            </span>
          ) : null}
          <button
            aria-label={`View ${document.name}`}
            className="group absolute inset-0 cursor-pointer"
            type="button"
            onClick={() => setViewerOpen(true)}
          >
            <span className="bg-background/70 absolute inset-0 flex items-center justify-center opacity-0 backdrop-blur-[2px] transition-opacity duration-150 group-hover:opacity-100">
              <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                <ArrowUpRightFromSquare className="size-3.5" />
                View document
              </span>
            </span>
          </button>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2 lg:max-h-96">
          {document.summary ? (
            <p className="text-muted line-clamp-3 shrink-0 text-xs leading-relaxed">
              {document.summary}
            </p>
          ) : null}
          {/* Fields clip against the item cap; the button below never does. */}
          <div
            ref={fieldsRegionRef}
            className={`bg-background/40 relative min-h-0 flex-1 overflow-hidden rounded-lg border ${
              hiddenFields > 0
                ? "[mask-image:linear-gradient(to_bottom,black_calc(100%-5rem),transparent)]"
                : ""
            }`}
          >
            <div className="flex flex-col gap-0.5 p-3 font-mono text-xs leading-relaxed">
              {lines.map((line) => (
                <div key={line.label} data-field-row>
                  <DocumentLineRow line={line} />
                </div>
              ))}
            </div>
          </div>
          <Button
            className="w-fit shrink-0"
            size="sm"
            variant="secondary"
            onPress={() => setViewerOpen(true)}
          >
            <ArrowUpRightFromSquare className="size-3.5" />
            View document
          </Button>
        </div>
      </div>

      <DocumentViewerModal
        document={document}
        isOpen={isViewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  );
}

/**
 * The full document viewer: the real PDF at reading size on the left, the
 * complete AI reading (summary + every extracted field) on the right.
 */
function DocumentViewerModal({
  document,
  isOpen,
  onOpenChange,
}: {
  document: ReviewDocument & { kind: "pdf"; src?: string };
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isLoaded, setLoaded] = useState(false);

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="max-w-full sm:w-[95vw]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{document.name}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="min-h-0">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <div className="relative h-[78dvh] w-full overflow-hidden rounded-lg border bg-white">
                  {!isLoaded && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Spinner aria-label="Loading document" size="sm" />
                    </span>
                  )}
                  <object
                    aria-label={document.name}
                    className={`h-full w-full transition-opacity duration-200 ${
                      isLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    data={`${document.src}#view=FitH`}
                    type="application/pdf"
                    onLoad={() => setLoaded(true)}
                  >
                    <div className="flex h-full items-center justify-center">
                      <a
                        className="text-accent text-xs underline-offset-2 hover:underline"
                        href={document.src}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open {document.name}
                      </a>
                    </div>
                  </object>
                </div>

                <div className="flex min-w-0 flex-col gap-3 lg:h-[78dvh] lg:overflow-y-auto lg:pr-1">
                  <span className="text-muted text-xs">
                    {document.meta} · received{" "}
                    {receivedAgo(document.receivedHoursAgo)}
                  </span>
                  {document.summary ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-muted text-xs font-medium">
                        AI summary
                      </span>
                      <p className="text-foreground text-sm leading-relaxed">
                        {document.summary}
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <span className="text-muted text-xs font-medium">
                      Extracted fields ({document.lines.length})
                    </span>
                    <div className="bg-background/40 flex flex-col gap-0.5 rounded-lg border p-3 font-mono text-xs leading-relaxed">
                      {document.lines.map((line) => (
                        <DocumentLineRow key={line.label} line={line} />
                      ))}
                    </div>
                  </div>
                  <a
                    className="text-muted hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors"
                    href={document.src}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ArrowUpRightFromSquare className="size-3" />
                    Open original in a new tab
                  </a>
                </div>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** One input, two jobs — notes on the Overview, questions in the Agent Trace. */
function Composer({
  onSubmit,
  onValueChange,
  placeholder,
  value,
}: {
  onSubmit: () => void;
  onValueChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <PromptInput
      value={value}
      onSubmit={onSubmit}
      onValueChange={onValueChange}
    >
      <PromptInput.Shell>
        <PromptInput.Content>
          <PromptInput.TextArea placeholder={placeholder} />
        </PromptInput.Content>
        <PromptInput.Toolbar>
          <PromptInput.ToolbarEnd>
            <PromptInput.Send>
              <ArrowUp className="size-4" />
            </PromptInput.Send>
          </PromptInput.ToolbarEnd>
        </PromptInput.Toolbar>
      </PromptInput.Shell>
    </PromptInput>
  );
}

/** The full phased reasoning transcript with inline citations — the Agent Trace tab. */
function TraceSection({ item }: { item: ReviewItem }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="text-muted size-3.5" />
        <span className="text-muted text-sm">
          Thought for {traceDuration(item)} ·{" "}
          {item.trace.reduce((sum, phase) => sum + phase.steps.length, 0)} steps
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {item.trace.map((phase) => (
          <ChainOfThought key={phase.label} defaultExpanded>
            <ChainOfThought.Trigger>
              <span className="text-foreground font-medium">{phase.label}</span>
              <span className="text-muted text-xs">
                {phase.steps.length}{" "}
                {phase.steps.length === 1 ? "step" : "steps"}
              </span>
            </ChainOfThought.Trigger>
            <ChainOfThought.Content>
              <ChainOfThought.Steps>
                {phase.steps.map((step) => {
                  const citation = step.citationRef
                    ? item.citations.find(
                        (entry) => entry.ref === step.citationRef,
                      )
                    : undefined;

                  return (
                    <ChainOfThought.Step
                      key={step.title}
                      label={
                        <span
                          className={
                            step.kind === "flag"
                              ? "text-warning font-medium"
                              : step.kind === "decision"
                                ? "text-accent font-medium"
                                : "text-foreground font-medium"
                          }
                        >
                          {step.title}
                        </span>
                      }
                    >
                      <div className="flex flex-col gap-1.5">
                        <span className="text-muted text-xs leading-relaxed">
                          {step.detail}
                        </span>
                        {step.data ? (
                          <div className="bg-background/40 flex flex-col gap-0.5 rounded-lg border p-2.5 font-mono text-xs leading-relaxed">
                            {step.data.map((line) => (
                              <span key={line}>{line}</span>
                            ))}
                          </div>
                        ) : null}
                        {citation ? (
                          <CitationPill
                            citation={citation}
                            document={findCitedDocument(item, citation)}
                          />
                        ) : null}
                      </div>
                    </ChainOfThought.Step>
                  );
                })}
              </ChainOfThought.Steps>
            </ChainOfThought.Content>
          </ChainOfThought>
        ))}
        <ChatSources defaultExpanded className="pt-3">
          <ChatSources.Trigger>
            <span className="inline-flex -space-x-1.5">
              {item.citations
                .filter((citation) => citation.href)
                .slice(0, 3)
                .map((citation) => (
                  <img
                    key={citation.ref}
                    alt=""
                    className="border-background size-5 rounded-full border object-cover"
                    src={faviconFor(citation.href ?? "")}
                  />
                ))}
            </span>
            <span>
              {item.citations.length}{" "}
              {item.citations.length === 1
                ? "source in total"
                : "sources in total"}
            </span>
          </ChatSources.Trigger>
          <ChatSources.Content>
            <ChatSources.List>
              {item.citations.map((citation) => (
                <CitationPill
                  key={citation.ref}
                  citation={citation}
                  document={findCitedDocument(item, citation)}
                />
              ))}
            </ChatSources.List>
          </ChatSources.Content>
        </ChatSources>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Detail pane — email-detail structure: toolbar · scrollable body · pinned action bar
 * -----------------------------------------------------------------------------------------------*/
interface NoteEntry {
  id: string;
  body: string;
  occurredAt: string;
}

function ReviewDetail({
  deadline,
  isFileLoading = false,
  item,
  notes,
  onAddNote,
  onBack,
  onNavigate,
  onResolve,
  position,
  total,
}: {
  deadline: Date;
  /** The per-shipment events fetch is still in flight — skeleton the file. */
  isFileLoading?: boolean;
  item: ReviewItem;
  notes: NoteEntry[];
  onAddNote: (body: string) => void;
  onBack: () => void;
  onNavigate: (direction: -1 | 1) => void;
  onResolve: (action: DecisionAction, alternate?: string) => void;
  position: number;
  total: number;
}) {
  const [alternate, setAlternate] = useState<string | null>(null);
  const [view, setView] = useState<"overview" | "trace">("overview");
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const threads = useReviewThreads();
  const thread = threads.get(item.id) ?? [];
  const chat = thread.filter((message) => message.kind === "chat");
  // The intake documents (invoice, packing list, B/L, spec…) collapse into ONE
  // tab-switched timeline item anchored at the earliest one. Emails, CBP
  // correspondence, and drafted responses are story beats — they keep their
  // own timeline slots at their own times. The rationale memo never renders
  // as a document; it opens from its event's "View memo" action.
  const isStandaloneDoc = (document: ReviewDocument) =>
    document.kind === "email" ||
    /cbp form 2[89]|draft response/i.test(document.name);
  const isMemoDoc = (document: ReviewDocument) =>
    document.kind === "pdf" && /rationale memo/i.test(document.name);
  const memoDocument = item.documents.find(
    (document): document is ReviewDocument & { kind: "pdf" } =>
      document.kind === "pdf" && isMemoDoc(document),
  );
  const intakeDocuments = item.documents.filter(
    (document) => !isStandaloneDoc(document) && !isMemoDoc(document),
  );
  const activity = [
    ...(intakeDocuments.length
      ? [
          {
            documents: intakeDocuments,
            hoursAgo: Math.max(
              ...intakeDocuments.map((document) => document.receivedHoursAgo),
            ),
            kind: "documents" as const,
          },
        ]
      : []),
    ...item.documents.filter(isStandaloneDoc).map((document) => ({
      document,
      hoursAgo: document.receivedHoursAgo,
      kind: "document" as const,
    })),
    ...(item.events ?? []).map((event) => ({
      event,
      hoursAgo: event.occurredHoursAgo,
      kind: "event" as const,
    })),
  ].sort((a, b) => b.hoursAgo - a.hoursAgo);
  const TypeIcon = typeMeta[item.type].icon;
  const tone = deadlineTone(deadline);
  // The latest agent-drafted document with an editable rich-text body.
  const responseDraft = [...item.documents]
    .reverse()
    .find(
      (doc): doc is ReviewDocument & { kind: "pdf" } =>
        doc.kind === "pdf" && Boolean(doc.draft),
    );
  const [editingDraft, setEditingDraft] = useState<
    (ReviewDocument & { kind: "pdf" }) | null
  >(null);
  const [isMemoOpen, setMemoOpen] = useState(false);

  const handleAddNote = () => {
    const body = draft.trim();

    if (!body) return;
    setDraft("");
    onAddNote(body);
  };

  const handleAsk = (question?: string) => {
    const body = (question ?? draft).trim();

    if (!body || isThinking) return;
    setDraft("");
    addThreadMessage(item.id, {
      author: "broker",
      body,
      id: `msg-${Date.now()}`,
      kind: "chat",
    });
    setIsThinking(true);
    setTimeout(() => {
      addThreadMessage(item.id, {
        author: "ai",
        body: aiReply(item, body),
        citationRef:
          body.endsWith("?") && item.citations[0]
            ? item.citations[0].ref
            : undefined,
        id: `msg-${Date.now()}-ai`,
        kind: "chat",
      });
      setIsThinking(false);
    }, 1100);
  };

  return (
    <div className="bg-background/40 flex max-h-full min-h-0 flex-1 flex-col gap-4 overflow-clip rounded-2xl border p-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            aria-label="Back to queue"
            className="border-border text-muted hover:text-foreground inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors lg:hidden"
            type="button"
            onClick={onBack}
          >
            <ChevronLeft className="size-4" />
          </button>
          <Chip size="sm" variant="soft">
            <TypeIcon className="size-3" />
            <Chip.Label>{typeMeta[item.type].label}</Chip.Label>
          </Chip>
          {item.noticeForm ? (
            <Chip color="danger" size="sm" variant="soft">
              <Chip.Label className="font-semibold">
                {item.noticeForm}
              </Chip.Label>
            </Chip>
          ) : null}
          <Chip
            color={tone === "default" ? "default" : tone}
            size="sm"
            variant="soft"
          >
            <Chip.Label>
              {formatDistanceToNowStrict(deadline, { addSuffix: true })}
            </Chip.Label>
          </Chip>
        </div>

        <div className="flex items-center gap-2 px-1">
          <Segment
            selectedKey={view}
            size="sm"
            onSelectionChange={(key) =>
              setView(key === "trace" ? "trace" : "overview")
            }
          >
            <Segment.Item id="overview">Overview</Segment.Item>
            <Segment.Item id="trace">
              <Sparkles className="size-3.5" />
              Agent Trace
            </Segment.Item>
          </Segment>
          <div className="flex items-center">
            <Button
              isIconOnly
              aria-label="Previous item"
              className="text-muted hover:text-foreground"
              isDisabled={position <= 1}
              size="sm"
              variant="ghost"
              onPress={() => onNavigate(-1)}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <Button
              isIconOnly
              aria-label="Next item"
              className="text-muted hover:text-foreground"
              isDisabled={position >= total}
              size="sm"
              variant="ghost"
              onPress={() => onNavigate(1)}
            >
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1 lg:px-4">
        <h1 className="text-foreground text-base font-semibold leading-normal">
          {item.question}
        </h1>
        <span className="text-muted text-xs">
          {item.client} · {item.reference} ·{" "}
          {formatCurrency(item.shipmentValue)} shipment
        </span>
      </div>

      {/* Body */}
      <ScrollShadow
        hideScrollBar
        className="min-h-0 flex-1 overflow-y-auto lg:px-4"
      >
        {view === "overview" ? (
          <div className="flex select-text flex-col gap-4 pb-4">
            {/* Proposal */}
            <Widget>
              <Widget.Header>
                <Widget.Title>{item.proposal.label}</Widget.Title>
              </Widget.Header>
              <Widget.Content className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-foreground text-xl font-semibold tabular-nums tracking-tight">
                    {item.proposal.value}
                  </span>
                  <Chip
                    color={item.confidence >= 0.9 ? "success" : "warning"}
                    size="md"
                    variant="soft"
                  >
                    <Chip.Label>
                      {Math.round(item.confidence * 100)}% confident
                    </Chip.Label>
                  </Chip>
                </div>
                <span className="text-muted text-sm">
                  {item.proposal.detail}
                </span>
                {item.dutyImpact ? (
                  <HoverCard closeDelay={100} openDelay={150}>
                    <HoverCard.Trigger className="mt-1.5 inline-flex w-fit">
                      <span className="border-border-secondary inline-flex cursor-default items-baseline gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5">
                        <span className="text-foreground text-sm font-semibold tabular-nums">
                          Duty{" "}
                          {formatCurrency(item.dutyImpact.proposed.amountUsd)}
                        </span>
                        <span className="text-muted text-xs">
                          {item.dutyImpact.proposed.rate}
                        </span>
                      </span>
                    </HoverCard.Trigger>
                    <HoverCard.Content className="p-3" placement="top">
                      <div className="flex flex-col gap-1 font-mono text-xs leading-relaxed">
                        {item.dutyImpact.proposed.breakdown.map((line) => (
                          <span key={line} className="text-muted">
                            {line}
                          </span>
                        ))}
                      </div>
                    </HoverCard.Content>
                  </HoverCard>
                ) : null}
                {item.citations.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-muted text-xs">Based on</span>
                    {item.citations.slice(0, 2).map((citation) => (
                      <CitationPill
                        key={citation.ref}
                        citation={citation}
                        document={findCitedDocument(item, citation)}
                      />
                    ))}
                  </div>
                ) : null}
                {item.noticeForm && responseDraft ? (
                  <button
                    className="group mt-1 flex w-fit cursor-pointer items-center gap-1.5"
                    type="button"
                    onClick={() => setEditingDraft(responseDraft)}
                  >
                    <FileCheck className="text-green-700 size-3.5 shrink-0" />
                    <span className="text-muted group-hover:text-foreground text-xs transition-colors">
                      Response draft ready. Review &amp; edit
                    </span>
                    <ChevronRight className="text-muted size-3" />
                  </button>
                ) : null}
                {item.alternates && item.alternates.length > 0 ? (
                  <>
                    <Separator className="my-2" />
                    <div className="flex flex-col gap-2">
                      <span className="text-muted text-xs font-medium">
                        Alternate classifications
                      </span>
                      {item.alternates.map((alt) => {
                        const isSelected = alternate === alt.value;

                        return (
                          <button
                            key={alt.value}
                            className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                              isSelected
                                ? "border-accent ring-accent/40 ring-1"
                                : "hover:border-foreground/25"
                            }`}
                            type="button"
                            onClick={() =>
                              setAlternate(isSelected ? null : alt.value)
                            }
                          >
                            <div className="flex flex-col">
                              <span className="text-foreground text-sm font-semibold tabular-nums">
                                {alt.value}
                              </span>
                              <span className="text-muted text-xs">
                                {alt.detail}
                              </span>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-0.5">
                              {(() => {
                                const impact =
                                  item.dutyImpact?.alternates?.[alt.value];
                                if (!impact) return null;

                                return (
                                  <span
                                    className={`whitespace-nowrap text-xs font-medium tabular-nums ${
                                      impact.deltaUsd > 0
                                        ? "text-danger"
                                        : impact.deltaUsd < 0
                                          ? "text-success"
                                          : "text-muted"
                                    }`}
                                  >
                                    {impact.deltaUsd === 0
                                      ? "$0 duty change"
                                      : `${impact.deltaUsd > 0 ? "+" : "−"}${formatCurrency(Math.abs(impact.deltaUsd))} duty`}
                                  </span>
                                );
                              })()}
                              <span className="text-muted text-xs tabular-nums">
                                {Math.round(alt.confidence * 100)}%
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </Widget.Content>
            </Widget>

            {/* Comparison — when two documents disagree, it's decision material */}
            {item.comparison ? (
              <Widget>
                <Widget.Header>
                  <Widget.Title>What differs between them</Widget.Title>
                </Widget.Header>
                <Widget.Content>
                  <div className="grid grid-cols-[minmax(96px,auto)_1fr_1fr] overflow-hidden rounded-lg border text-xs">
                    <div className="bg-default/40 p-2.5" />
                    <div className="bg-default/40 text-foreground p-2.5 font-medium">
                      {item.comparison.docA}
                    </div>
                    <div className="bg-default/40 text-foreground p-2.5 font-medium">
                      {item.comparison.docB}
                    </div>
                    {item.comparison.rows.map((row) => (
                      <div key={row.label} className="contents">
                        <div className="text-muted border-t p-2.5">
                          {row.label}
                        </div>
                        <div className="text-foreground border-t p-2.5">
                          {row.a}
                        </div>
                        <div className="text-foreground border-t p-2.5">
                          {row.b}
                        </div>
                      </div>
                    ))}
                  </div>
                </Widget.Content>
              </Widget>
            ) : null}

            {/* Shipment — one scannable strip */}
            <Widget>
              <Widget.Content className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
                <ShipmentFact label="Origin" value={item.shipment.origin} />
                <ShipmentFact label="Port" value={item.shipment.port} />
                <ShipmentFact
                  label="Arrives"
                  value={
                    item.shipment.arrivesInHours === null
                      ? "—"
                      : formatDistanceToNowStrict(
                          addHours(new Date(), item.shipment.arrivesInHours),
                          { addSuffix: true },
                        )
                  }
                />
                <ShipmentFact label="Mode" value={item.shipment.mode} />
                <ShipmentFact label="Incoterm" value={item.shipment.incoterm} />
                <ShipmentFact label="Entry" value={item.shipment.entryType} />
              </Widget.Content>
            </Widget>

            {/* Activity — documents, events, and your notes to the AI, oldest first */}
            <div className="flex flex-col gap-2">
              <span className="text-muted text-xs font-medium">Activity</span>
              {isFileLoading ? (
                <ActivitySkeleton />
              ) : (
                <Timeline density="comfortable" size="sm">
                  {activity.map((entry, index) =>
                    entry.kind === "documents" ? (
                      <DocumentsTimelineItem
                        key="documents"
                        _index={index}
                        _isLast={false}
                        documents={entry.documents}
                        onEditDraft={(document) => setEditingDraft(document)}
                      />
                    ) : entry.kind === "document" ? (
                      <SingleDocumentTimelineItem
                        key={
                          entry.document.kind === "email"
                            ? entry.document.subject
                            : entry.document.name
                        }
                        _index={index}
                        _isLast={false}
                        document={entry.document}
                        onEditDraft={
                          entry.document.kind === "pdf" && entry.document.draft
                            ? () =>
                                setEditingDraft(
                                  entry.document as ReviewDocument & {
                                    kind: "pdf";
                                  },
                                )
                            : undefined
                        }
                      />
                    ) : (
                      <EventTimelineItem
                        key={entry.event.title}
                        _index={index}
                        _isLast={false}
                        event={entry.event}
                        onViewMemo={
                          memoDocument ? () => setMemoOpen(true) : undefined
                        }
                        onViewTrace={() => setView("trace")}
                      />
                    ),
                  )}
                  {notes.map((note, index) => (
                    <ThreadTimelineItem
                      key={note.id}
                      _index={activity.length + index}
                      _isLast={false}
                      message={{
                        author: "broker",
                        body: note.body,
                        id: note.id,
                        kind: "note",
                      }}
                      time={formatDistanceToNowStrict(
                        new Date(note.occurredAt),
                        {
                          addSuffix: true,
                        },
                      )}
                    />
                  ))}
                  <Timeline.Item
                    _index={activity.length + notes.length}
                    _isLast
                    align="start"
                    status="default"
                  >
                    <Timeline.Marker aria-hidden="true" className="size-6">
                      <Pencil className="size-3.5" />
                    </Timeline.Marker>
                    <Timeline.Content className="gap-2">
                      <Composer
                        placeholder="Add a note to the audit record…"
                        value={draft}
                        onSubmit={handleAddNote}
                        onValueChange={setDraft}
                      />
                    </Timeline.Content>
                  </Timeline.Item>
                </Timeline>
              )}
            </div>
          </div>
        ) : (
          <div className="flex select-text flex-col gap-5 pb-4">
            <TraceSection item={item} />

            {/* Conversation — interrogate the agent; answers join the audit record */}
            <div className="flex flex-col gap-3">
              <span className="text-muted text-xs font-medium">
                Ask the agent
              </span>
              {chat.length === 0 && !isThinking ? (
                <PromptSuggestion>
                  <PromptSuggestion.Items>
                    <PromptSuggestion.Item
                      onPress={() =>
                        handleAsk("Why are you confident in this?")
                      }
                    >
                      Why are you confident in this?
                    </PromptSuggestion.Item>
                    <PromptSuggestion.Item
                      onPress={() =>
                        handleAsk("What would change your recommendation?")
                      }
                    >
                      What would change your recommendation?
                    </PromptSuggestion.Item>
                  </PromptSuggestion.Items>
                </PromptSuggestion>
              ) : null}
              {chat.map((message) =>
                message.author === "broker" ? (
                  <ChatMessage.User key={message.id}>
                    <ChatMessage.Bubble>
                      <p className="m-0 text-sm">{message.body}</p>
                    </ChatMessage.Bubble>
                  </ChatMessage.User>
                ) : (
                  <ChatMessage.Assistant key={message.id}>
                    <ChatMessage.Avatar alt="Azali AI" fallback="✦" />
                    <ChatMessage.Body>
                      <ChatMessage.Content>{message.body}</ChatMessage.Content>
                      {(() => {
                        const cited = message.citationRef
                          ? item.citations.find(
                              (entry) => entry.ref === message.citationRef,
                            )
                          : undefined;

                        return cited ? (
                          <CitationPill
                            citation={cited}
                            document={findCitedDocument(item, cited)}
                          />
                        ) : null;
                      })()}
                    </ChatMessage.Body>
                  </ChatMessage.Assistant>
                ),
              )}
              {isThinking ? (
                <ChatMessage.Assistant>
                  <ChatMessage.Avatar alt="Azali AI" fallback="✦" />
                  <ChatMessage.Body>
                    <div className="flex items-center gap-2 py-1.5">
                      <ChatLoader.Dots size="sm" />
                      <TextShimmer className="text-xs">
                        Azali AI is thinking…
                      </TextShimmer>
                    </div>
                  </ChatMessage.Body>
                </ChatMessage.Assistant>
              ) : null}
              <Composer
                placeholder="Ask the agent — answers cite sources and join the audit record…"
                value={draft}
                onSubmit={() => handleAsk()}
                onValueChange={setDraft}
              />
            </div>
          </div>
        )}
      </ScrollShadow>

      {/* Actions — pinned below the scroll area */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {item.canRequestInfo ? (
          <Button variant="ghost" onPress={() => onResolve("info-requested")}>
            Request Info
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="lg"
          onPress={() =>
            onResolve(
              alternate ? "corrected" : "approved",
              alternate ?? undefined,
            )
          }
        >
          <CircleCheck />
          {alternate ? `Approve ${alternate}` : item.approveLabel}
        </Button>
      </div>

      <ResponseDraftModal
        document={editingDraft}
        isOpen={Boolean(editingDraft)}
        shipmentId={item.id}
        onOpenChange={(open) => {
          if (!open) setEditingDraft(null);
        }}
      />
      {memoDocument ? (
        <ResponseDraftModal
          readOnly
          document={memoDocument}
          isOpen={isMemoOpen}
          shipmentId={item.id}
          onOpenChange={setMemoOpen}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Empty pane — email empty-state structure: icon tile · title · description
 * -----------------------------------------------------------------------------------------------*/
function EmptyPane({ isQueueClear }: { isQueueClear: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-2xl border px-6 py-16 text-center">
      <div className="bg-default/60 flex size-12 items-center justify-center rounded-2xl">
        <CircleCheck className="text-muted size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-base font-semibold">
          {isQueueClear ? "Queue clear" : "Nothing selected"}
        </h2>
        <p className="text-muted max-w-[320px] text-sm">
          {isQueueClear
            ? "Autopilot is handling everything else. New exceptions will appear here."
            : "Pick an item from the queue to review it here."}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ReviewQueue
 * -----------------------------------------------------------------------------------------------*/
export function ReviewQueue() {
  const queryClient = useQueryClient();
  const params = useParams({ strict: false });
  const searchParams = useSearch({ strict: false }) as ReviewSearch;
  const navigate = useNavigate();
  // Filter + search live in the URL and drive the server-side query.
  const filterId = searchParams.type ?? "all";
  const { deadlines, items, isFetching, isPending } =
    useLiveReviewItems(searchParams);
  const { data: statsResponse } = useShipmentsControllerStats();
  const resolveReviewMutation = useShipmentsControllerResolve();
  const [searchInput, setSearchInput] = useState(searchParams.q ?? "");
  // Selection lives in the path (/dashboard/review/<shipmentId>) so queue
  // items are deep-linkable from the pipeline board and shareable.
  const selectedId = params.itemId ?? null;
  const setSelectedId = (id: string | null) => {
    if (id) {
      navigate({
        params: { itemId: id },
        replace: true,
        search: (prev) => prev,
        to: "/dashboard/review/$itemId",
      });
    } else {
      navigate({
        replace: true,
        search: (prev) => prev,
        to: "/dashboard/review",
      });
    }
  };
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(() =>
    Boolean(params.itemId),
  );
  // Session log of what got resolved, so the "Resolved today" section keeps
  // its history after the server drops the items from the pending list.
  const [resolved, setResolved] = useState<
    Array<{ decision: Decision; item: ReviewItem }>
  >([]);

  // Keep the input in sync with the URL (back/forward, shared links).
  useEffect(() => {
    setSearchInput(searchParams.q ?? "");
  }, [searchParams.q]);

  // Debounce typing into the URL; the server does the searching.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((searchParams.q ?? "") !== searchInput) {
        navigate({
          replace: true,
          search: (prev: ReviewSearch) => ({
            ...prev,
            q: searchInput || undefined,
          }),
          to: ".",
        });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // biome-ignore lint/correctness/useExhaustiveDependencies: navigate identity is unstable
  }, [searchInput, searchParams.q]);

  const deadlineFor = (item: ReviewItem) =>
    deadlines.get(item.id) ?? addHours(new Date(), item.deadlineHoursFromNow);

  const resolvedIds = useMemo(
    () => new Set(resolved.map((entry) => entry.item.id)),
    [resolved],
  );
  // The server already applied filter + search; only hide items resolved in
  // this session while the refetch is in flight.
  const visiblePending = items.filter((item) => !resolvedIds.has(item.id));
  const pending = visiblePending;

  const countFor = (types: readonly string[] | null) => {
    const stats = statsResponse?.data;
    if (!stats) return 0;
    if (!types) return stats.byStatus.needs_review;

    return types.reduce(
      (sum, type) => sum + (stats.byReviewType[type] ?? 0),
      0,
    );
  };

  const displayItem =
    visiblePending.find((item) => item.id === selectedId) ??
    visiblePending[0] ??
    null;
  const displayIndex = displayItem
    ? visiblePending.findIndex((item) => item.id === displayItem.id)
    : -1;

  // One fetch for the whole case file — split by event type at the edge.
  const { data: eventsResponse, isPending: isFileLoading } =
    useShipmentEventsControllerFindByShipment(
      displayItem?.id ?? "",
      { limit: 200 },
      { query: { enabled: Boolean(displayItem) } },
    );

  const live = useMemo(() => {
    // API returns occurredAt desc; the record reads oldest-first.
    const events = [...(eventsResponse?.data.data ?? [])].reverse();
    const now = Date.now();
    const hoursAgo = (occurredAt: string) =>
      (now - new Date(occurredAt).getTime()) / 3_600_000;

    // Agent trace — one event per step, grouped by payload.phase.
    const trace: TracePhase[] = [];

    for (const event of events.filter((e) => eventPlane(e.type) === "trace")) {
      const payload = event.payload as {
        phase?: string;
        kind?: TraceStepKind;
        detail?: string;
        data?: string[];
        citationRef?: string;
      };
      const label = payload.phase ?? "Trace";
      const step = {
        kind: payload.kind ?? "read",
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
    const activityEvents: ActivityEvent[] = events
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

    // Structured shipment facts (latest extraction wins).
    const factsEvent = events
      .filter((event) => event.type === FACTS_EVENT_TYPE)
      .at(-1);
    const facts = factsEvent?.payload.facts as
      | {
          originCountry?: string;
          originPort?: string | null;
          portOfEntry?: string;
          transportMode?: string;
          conveyance?: string | null;
          incoterm?: string | null;
          entryType?: string | null;
        }
      | undefined;

    // Broker notes — part of the audit record.
    const notes = events
      .filter((event) => event.type === BROKER_NOTE_TYPE)
      .map((event) => ({
        id: event.id,
        body: String((event.payload as { body?: string }).body ?? event.title),
        occurredAt: event.occurredAt,
      }));

    return { activityEvents, documents, facts, notes, trace };
  }, [eventsResponse]);

  const detailItem = displayItem
    ? {
        ...displayItem,
        trace: live.trace,
        documents: live.documents,
        events: live.activityEvents,
        ...(live.facts && {
          shipment: {
            ...displayItem.shipment,
            origin: live.facts.originPort
              ? `${countryName(live.facts.originCountry ?? "")} (${live.facts.originPort})`
              : countryName(live.facts.originCountry ?? ""),
            port: live.facts.portOfEntry ?? displayItem.shipment.port,
            mode: live.facts.conveyance
              ? `${capitalize(live.facts.transportMode ?? "")} · ${live.facts.conveyance}`
              : capitalize(live.facts.transportMode ?? ""),
            incoterm: live.facts.incoterm ?? displayItem.shipment.incoterm,
            entryType: live.facts.entryType ?? displayItem.shipment.entryType,
          },
        }),
      }
    : null;

  const createEvent = useShipmentEventsControllerCreate();

  const handleAddNote = (body: string) => {
    if (!displayItem) return;
    const shipmentId = displayItem.id;

    createEvent
      .mutateAsync({
        shipmentId,
        data: {
          type: BROKER_NOTE_TYPE,
          actor: "user",
          title: "Broker note added to the audit record",
          payload: { body },
        },
      })
      .then(() => {
        queryClient.invalidateQueries({
          queryKey:
            getShipmentEventsControllerFindByShipmentQueryKey(shipmentId),
        });
      })
      .catch(() => {
        toast.danger("Failed to save note");
      });
  };

  const handleFilterChange = (id: string) => {
    navigate({
      replace: true,
      search: (prev: ReviewSearch) => ({
        ...prev,
        type: id === "all" ? undefined : (id as ReviewSearch["type"]),
      }),
      to: ".",
    });
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setIsMobileDetailOpen(true);
  };

  const handleNavigate = (direction: -1 | 1) => {
    const next = visiblePending[displayIndex + direction];

    if (next) setSelectedId(next.id);
  };

  const handleResolve = (action: DecisionAction, alternate?: string) => {
    if (!displayItem) return;
    const item = displayItem;
    const next =
      visiblePending[displayIndex + 1] ??
      visiblePending[displayIndex - 1] ??
      null;

    const run = resolveReviewMutation
      .mutateAsync({
        data: {
          action: action === "info-requested" ? "info_requested" : action,
          ...(alternate && { alternate }),
        },
        id: item.id,
      })
      .then(async () => {
        // Everything shipment-shaped: the list, stats, the global event feed,
        // and per-shipment timelines all live under /v1/shipments.
        await queryClient.invalidateQueries({
          predicate: (query) =>
            String(query.queryKey[0]).startsWith("/v1/shipments"),
        });
      });

    toast.promise(run, {
      error: "Failed to resolve review",
      loading: "Resolving review...",
      success:
        action === "approved"
          ? `Approved ${item.reference}`
          : action === "corrected"
            ? `Corrected ${item.reference} → ${alternate}`
            : `Requested more info for ${item.reference}`,
    });

    // Info requests keep the shipment in the queue server-side.
    if (action !== "info-requested") {
      setResolved((current) => [
        ...current,
        { decision: { action, alternate }, item },
      ]);
      setSelectedId(next?.id ?? null);
      if (!next) setIsMobileDetailOpen(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-24px)] min-h-[480px] w-full flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(300px,340px)_1fr] lg:gap-4">
      {/* Queue list */}
      <div
        className={`min-h-0 overflow-hidden ${
          isMobileDetailOpen
            ? "hidden lg:flex lg:flex-col"
            : "flex flex-1 flex-col"
        }`}
      >
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-clip pb-2">
          <SearchField
            aria-label="Search review items"
            value={searchInput}
            onChange={setSearchInput}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search the queue..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

          <div className="flex flex-wrap items-center gap-1.5">
            {REVIEW_FILTER_GROUPS.map((group) => {
              const count = countFor(group.types);

              return (
                <Button
                  key={group.id}
                  size="sm"
                  variant={filterId === group.id ? "primary" : "secondary"}
                  onPress={() => handleFilterChange(group.id)}
                >
                  {group.label}
                  {count > 0 && (
                    <Chip size="sm" variant="soft">
                      {count}
                    </Chip>
                  )}
                </Button>
              );
            })}
          </div>

          <ScrollShadow
            hideScrollBar
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {isPending ? (
              <QueueSkeleton />
            ) : visiblePending.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                <p className="text-foreground text-sm font-medium">
                  No pending items here
                </p>
                <p className="text-muted max-w-[220px] text-xs">
                  Exceptions matching this view will show up here.
                </p>
              </div>
            ) : (
              <TableFetchingState isFetching={isFetching}>
                <ul className="flex flex-col gap-0.5">
                  {visiblePending.map((item) => (
                    <QueueRow
                      key={item.id}
                      deadline={deadlineFor(item)}
                      isActive={item.id === displayItem?.id}
                      item={item}
                      onSelect={() => handleSelect(item.id)}
                    />
                  ))}
                </ul>
              </TableFetchingState>
            )}

            {/* Resolved today */}
            {resolved.length > 0 ? (
              <div className="mt-4 flex flex-col gap-0.5">
                <span className="text-muted px-3 pb-1 text-xs font-medium">
                  Resolved today ({resolved.length})
                </span>
                {resolved.map(({ decision, item }) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-2xl px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CircleCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div className="flex min-w-0 flex-col">
                        <span className="text-muted truncate text-xs">
                          {item.question}
                        </span>
                        <span className="text-muted/70 text-xs">
                          {decisionLabel(decision)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </ScrollShadow>
        </div>
      </div>

      {/* Detail */}
      <div
        className={`min-h-0 overflow-hidden ${
          isMobileDetailOpen
            ? "flex flex-1 flex-col"
            : "hidden lg:flex lg:flex-col"
        }`}
      >
        {detailItem ? (
          <ReviewDetail
            key={detailItem.id}
            deadline={deadlineFor(detailItem)}
            isFileLoading={isFileLoading}
            item={detailItem}
            notes={live.notes}
            position={displayIndex + 1}
            total={visiblePending.length}
            onAddNote={handleAddNote}
            onBack={() => setIsMobileDetailOpen(false)}
            onNavigate={handleNavigate}
            onResolve={handleResolve}
          />
        ) : isPending ? null : (
          <EmptyPane isQueueClear={pending.length === 0} />
        )}
      </div>
    </div>
  );
}
