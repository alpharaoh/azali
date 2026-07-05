import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRightFromSquare,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDollar,
  Envelope,
  FileCheck,
  FileText,
  PaperPlane,
  Pencil,
  Person,
  ShieldCheck,
  ShieldExclamation,
  Sparkles,
  Tag,
} from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Card,
  Chip,
  ScrollShadow,
  SearchField,
  Separator,
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
import type { ComponentProps, ComponentType, SVGProps } from "react";
import { useEffect, useMemo, useState } from "react";

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
  ThreadMessage,
  TracePhase,
  TraceStepKind,
} from "#/data/review-queue";
import {
  addThreadMessage,
  docSlug,
  reviewItems as mockReviewItems,
  useReviewThreads,
} from "#/data/review-queue";
import type { ListShipmentsResponseDtoDataItem as ApiShipment } from "#/generated/api";
import {
  getShipmentEventsControllerFindAllQueryKey,
  getShipmentsControllerFindAllQueryKey,
  useShipmentEventsControllerFindAll,
  useShipmentsControllerFindAll,
  useShipmentsControllerResolveReview,
  useShipmentsControllerStats,
} from "#/generated/api";
import { countryName } from "#/lib/countries";
import type { ReviewSearch } from "#/lib/review-queue-loader";
import {
  REVIEW_FILTER_GROUPS,
  reviewListParams,
} from "#/lib/review-queue-loader";
import { useClientsById } from "#/lib/use-clients-by-id";

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
 * Live data — real shipments in needs_review, enriched with the mock items'
 * demo content (trace, citations, documents) matched by reference until the
 * product produces those artifacts for real.
 * -----------------------------------------------------------------------------------------------*/
interface ReviewRequestPayload {
  reviewType?: ReviewItemType;
  question?: string;
  confidence?: number;
  proposal?: ReviewItem["proposal"];
}

const mockByReference = new Map(
  mockReviewItems.map((item) => [item.reference, item]),
);

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toReviewItem(
  shipment: ApiShipment,
  payload: ReviewRequestPayload,
  client: { name: string; logo?: string } | undefined,
): ReviewItem {
  const base = mockByReference.get(shipment.reference);
  const arrivesInHours = shipment.etaAt
    ? (new Date(shipment.etaAt).getTime() - Date.now()) / 3_600_000
    : (base?.shipment.arrivesInHours ?? 0);

  return {
    alternates: base?.alternates,
    approveLabel: base?.approveLabel ?? "Approve",
    canRequestInfo: base?.canRequestInfo,
    citations: base?.citations ?? [],
    client: client?.name ?? base?.client ?? "Unknown client",
    comparison: base?.comparison,
    confidence: payload.confidence ?? base?.confidence ?? 0.8,
    deadlineHoursFromNow: shipment.reviewDeadlineAt
      ? (new Date(shipment.reviewDeadlineAt).getTime() - Date.now()) / 3_600_000
      : (base?.deadlineHoursFromNow ?? 24),
    documents: base?.documents ?? [],
    events: base?.events,
    id: shipment.id,
    logo: client?.logo ?? base?.logo,
    postEntry: base?.postEntry,
    proposal: payload.proposal ??
      base?.proposal ?? { detail: "", label: "Proposal", value: "—" },
    question: payload.question ?? base?.question ?? "Review required",
    reference: shipment.reference,
    shipment: {
      arrivesInHours,
      entryType:
        shipment.entryType ?? base?.shipment.entryType ?? "01 — Consumption",
      incoterm: shipment.incoterm ?? base?.shipment.incoterm ?? "FOB",
      mode: shipment.conveyance
        ? `${capitalize(shipment.transportMode)} · ${shipment.conveyance}`
        : capitalize(shipment.transportMode),
      origin: shipment.originPort
        ? `${countryName(shipment.originCountry)} (${shipment.originPort})`
        : countryName(shipment.originCountry),
      port: shipment.portOfEntry,
    },
    shipmentValue: shipment.valueCents / 100,
    trace: base?.trace ?? [],
    type: payload.reviewType ?? base?.type ?? "classification",
  };
}

function useLiveReviewItems(search: ReviewSearch) {
  const clientsById = useClientsById();

  const { data: shipmentsResponse } = useShipmentsControllerFindAll(
    reviewListParams(search),
    { query: { placeholderData: keepPreviousData } },
  );
  const { data: reviewEventsResponse } = useShipmentEventsControllerFindAll({
    limit: 200,
    type: ["review_requested"],
  });

  return useMemo(() => {
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
      toReviewItem(
        shipment,
        latestPayload.get(shipment.id) ?? {},
        clientsById.get(shipment.clientId),
      ),
    );

    const deadlines = new Map(
      shipments.flatMap((shipment) =>
        shipment.reviewDeadlineAt
          ? [[shipment.id, new Date(shipment.reviewDeadlineAt)] as const]
          : [],
      ),
    );

    return { deadlines, items };
  }, [shipmentsResponse, reviewEventsResponse, clientsById]);
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
    <div className="flex min-w-0 flex-col gap-0.5">
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

const eventIconMap: Record<
  ActivityEvent["icon"],
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  ai: Sparkles,
  check: CircleCheck,
  mail: PaperPlane,
};

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

  const href = doc.kind === "scan" ? doc.src : `/docs/${docSlug(doc.name)}.pdf`;

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
  ...rest
}: { message: ThreadMessage } & TimelineItemPassthrough) {
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
          <time className="text-muted shrink-0 text-xs leading-5">
            just now
          </time>
        </div>
        <p className="text-muted m-0 text-xs leading-5">{message.body}</p>
      </Timeline.Content>
    </Timeline.Item>
  );
}

function EventTimelineItem({
  event,
  onViewTrace,
  ...rest
}: {
  event: ActivityEvent;
  onViewTrace?: () => void;
} & TimelineItemPassthrough) {
  const Icon = eventIconMap[event.icon];

  return (
    <Timeline.Item align="start" status={event.status ?? "default"} {...rest}>
      <Timeline.Marker aria-hidden="true" className="size-6">
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
          <p className="text-muted m-0 text-xs leading-5">{event.detail}</p>
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

function DocumentTimelineItem({
  document,
  ...rest
}: { document: ReviewDocument } & TimelineItemPassthrough) {
  const Icon = document.kind === "email" ? Envelope : FileText;
  const title = document.kind === "email" ? document.subject : document.name;
  const meta =
    document.kind === "email" ? `From ${document.from}` : document.meta;
  const action =
    document.kind === "email"
      ? { icon: ArrowUpRightFromSquare, label: "Open" }
      : document.kind === "scan"
        ? {
            icon: ArrowUpRightFromSquare,
            label: "Open Scan",
            onPress: () => window.open(document.src, "_blank"),
          }
        : { icon: ArrowDownToLine, label: "Download" };
  const ActionIcon = action.icon;

  return (
    <Timeline.Item align="start" status="default" {...rest}>
      <Timeline.Marker aria-hidden="true" className="size-6">
        <Icon className="text-muted size-3.5" />
      </Timeline.Marker>
      <Timeline.Content className="gap-2">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h3 className="text-foreground m-0 min-w-0 truncate text-xs font-medium leading-5">
            {title}
          </h3>
          <div className="text-muted flex shrink-0 items-center gap-2 text-xs leading-5">
            <span>{meta}</span>
            <time>{receivedAgo(document.receivedHoursAgo)}</time>
            <Button
              isIconOnly
              aria-label={action.label}
              className="size-6 min-h-6 min-w-6"
              size="sm"
              variant="tertiary"
              onPress={action.onPress}
            >
              <ActionIcon className="size-3.5" />
            </Button>
          </div>
        </div>
        <Card>
          <Card.Content className="flex flex-col gap-2">
            {document.kind === "email" ? (
              <>
                <span className="text-muted text-xs">
                  From: {document.from} · {document.meta}
                </span>
                <p className="bg-background/40 text-foreground rounded-lg border p-3 text-xs leading-relaxed">
                  {document.body}
                </p>
              </>
            ) : (
              <>
                {document.kind === "scan" ? (
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
                    <span className="text-muted text-xs font-medium">
                      AI-extracted fields
                    </span>
                  </>
                ) : null}
                <div className="bg-background/40 flex flex-col gap-0.5 rounded-lg border p-3 font-mono text-xs leading-relaxed">
                  {(document.kind === "scan"
                    ? document.extracted
                    : document.lines
                  ).map((line) => (
                    <DocumentLineRow key={line.label} line={line} />
                  ))}
                </div>
                {document.note ? (
                  <span className="text-muted inline-flex items-start gap-1.5 text-xs">
                    <Sparkles className="mt-0.5 size-3 shrink-0" />
                    {document.note}
                  </span>
                ) : null}
              </>
            )}
          </Card.Content>
        </Card>
      </Timeline.Content>
    </Timeline.Item>
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
function ReviewDetail({
  deadline,
  item,
  onBack,
  onNavigate,
  onResolve,
  position,
  total,
}: {
  deadline: Date;
  item: ReviewItem;
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
  const notes = thread.filter((message) => message.kind === "note");
  const chat = thread.filter((message) => message.kind === "chat");
  const activity = [
    ...item.documents.map((document) => ({
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

  const handleAddNote = () => {
    const body = draft.trim();

    if (!body) return;
    setDraft("");
    addThreadMessage(item.id, {
      author: "broker",
      body,
      id: `msg-${Date.now()}`,
      kind: "note",
    });
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
          <span className="text-muted whitespace-nowrap text-xs tabular-nums">
            {position} of {total}
          </span>
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

      {/* Title + view switch */}
      <div className="flex flex-col gap-3 lg:px-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-base font-semibold leading-normal">
            {item.question}
          </h1>
          <span className="text-muted text-xs">
            {item.client} · {item.reference} ·{" "}
            {formatCurrency(item.shipmentValue)} shipment
          </span>
        </div>
        <Segment
          className="self-start w-80"
          selectedKey={view}
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
              </Widget.Content>
            </Widget>

            {/* Shipment */}
            <Widget>
              <Widget.Header>
                <Widget.Title>Shipment</Widget.Title>
              </Widget.Header>
              <Widget.Content className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <ShipmentFact label="Origin" value={item.shipment.origin} />
                <ShipmentFact
                  label="Port of entry"
                  value={item.shipment.port}
                />
                <ShipmentFact
                  label="Arrives"
                  value={formatDistanceToNowStrict(
                    addHours(new Date(), item.shipment.arrivesInHours),
                    { addSuffix: true },
                  )}
                />
                <ShipmentFact label="Mode" value={item.shipment.mode} />
                <ShipmentFact label="Incoterm" value={item.shipment.incoterm} />
                <ShipmentFact
                  label="Entry type"
                  value={item.shipment.entryType}
                />
              </Widget.Content>
            </Widget>

            {/* Activity — documents, events, and your notes to the AI, oldest first */}
            <div className="flex flex-col gap-2">
              <span className="text-muted text-xs font-medium">Activity</span>
              <Timeline density="compact" size="sm">
                {activity.map((entry, index) =>
                  entry.kind === "document" ? (
                    <DocumentTimelineItem
                      key={
                        entry.document.kind === "email"
                          ? entry.document.subject
                          : entry.document.name
                      }
                      _index={index}
                      _isLast={false}
                      document={entry.document}
                    />
                  ) : (
                    <EventTimelineItem
                      key={entry.event.title}
                      _index={index}
                      _isLast={false}
                      event={entry.event}
                      onViewTrace={() => setView("trace")}
                    />
                  ),
                )}
                {notes.map((message, index) => (
                  <ThreadTimelineItem
                    key={message.id}
                    _index={activity.length + index}
                    _isLast={false}
                    message={message}
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
            </div>

            {/* Comparison — when two documents disagree */}
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

            {/* Alternates */}
            {item.alternates && item.alternates.length > 0 ? (
              <>
                <Separator />
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
                        <span className="text-muted text-xs tabular-nums">
                          {Math.round(alt.confidence * 100)}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
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
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        {item.canRequestInfo ? (
          <Button variant="ghost" onPress={() => onResolve("info-requested")}>
            Request Info
          </Button>
        ) : null}
        <Button
          variant="primary"
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
  const { deadlines, items } = useLiveReviewItems(searchParams);
  const { data: statsResponse } = useShipmentsControllerStats();
  const resolveReviewMutation = useShipmentsControllerResolveReview();
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

  // The agent trace comes from the shipment's agent_trace events — one event
  // per step, with phase/kind/detail/data in the payload.
  const { data: traceEventsResponse } = useShipmentEventsControllerFindAll(
    { limit: 200, shipmentId: displayItem?.id, type: ["agent_trace"] },
    { query: { enabled: Boolean(displayItem) } },
  );

  const liveTrace = useMemo<TracePhase[]>(() => {
    // API returns occurredAt desc; the trace reads oldest-first.
    const events = [...(traceEventsResponse?.data.data ?? [])].reverse();
    const phases: TracePhase[] = [];

    for (const event of events) {
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
      const last = phases[phases.length - 1];

      if (last?.label === label) last.steps.push(step);
      else phases.push({ label, steps: [step] });
    }

    return phases;
  }, [traceEventsResponse]);

  const detailItem = displayItem
    ? {
        ...displayItem,
        trace: liveTrace.length ? liveTrace : displayItem.trace,
      }
    : null;

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
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getShipmentsControllerFindAllQueryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: getShipmentEventsControllerFindAllQueryKey(),
          }),
        ]);
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
    <div className="flex h-[calc(100dvh-72px)] min-h-[480px] w-full flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(300px,340px)_1fr] lg:gap-4">
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
            {visiblePending.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                <p className="text-foreground text-sm font-medium">
                  No pending items here
                </p>
                <p className="text-muted max-w-[220px] text-xs">
                  Exceptions matching this view will show up here.
                </p>
              </div>
            ) : (
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
            item={detailItem}
            position={displayIndex + 1}
            total={visiblePending.length}
            onBack={() => setIsMobileDetailOpen(false)}
            onNavigate={handleNavigate}
            onResolve={handleResolve}
          />
        ) : (
          <EmptyPane isQueueClear={pending.length === 0} />
        )}
      </div>
    </div>
  );
}
