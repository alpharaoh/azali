import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconChevronLeft,
  IconCircleCheck,
  IconCurrencyDollar,
  IconFileText,
  IconPageCheck,
  IconPencil,
  IconShieldBreak,
  IconShieldCheck,
  IconSparklesThree,
  IconTag,
  IconUser,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Button, Chip, ScrollShadow } from "@heroui/react";
import {
  ChatSources,
  HoverCard,
  PromptInput,
  Segment,
  Timeline,
  Widget,
} from "@heroui-pro/react";
import { differenceInHours, formatDistanceToNowStrict } from "date-fns";
import type { ComponentType } from "react";
import { useState } from "react";
import { AgentRunTrace } from "#/components/case-file/agent-run-trace";
import {
  CitationPill,
  faviconFor,
  findCitedDocument,
} from "#/components/case-file/citations";
import {
  DocumentsTimelineItem,
  SingleDocumentTimelineItem,
} from "#/components/case-file/document-items";
import { LineClassificationsCard } from "#/components/case-file/line-classifications-card";
import {
  AlternatesList,
  LineDetailDrawer,
} from "#/components/case-file/line-detail-drawer";
import { LineTraceTabs } from "#/components/case-file/line-trace-tabs";
import { ShipmentFactsStrip } from "#/components/case-file/shipment-facts";
import {
  ActivitySkeleton,
  EventTimelineItem,
  type TimelineItemPassthrough,
} from "#/components/case-file/timeline-items";
import { ClampedText } from "#/components/clamped-text";
import { ConfidenceChip } from "#/components/confidence-chip";
import { ResponseDraftModal } from "#/components/response-draft-modal";
import { formatCurrency } from "#/lib/format";
import type {
  DecisionAction,
  LineCorrection,
  ReviewDocument,
  ReviewItem,
  ReviewItemType,
  ReviewLineItem,
} from "#/lib/review-types";
import { isMultiLineReview } from "#/lib/review-types";

/* -------------------------------------------------------------------------------------------------
 * Meta
 * -----------------------------------------------------------------------------------------------*/
type TypeIconComponent = ComponentType<{
  className?: string;
  mode?: "masked" | "raw";
}>;

export const typeMeta: Record<
  ReviewItemType,
  { label: string; icon: TypeIconComponent }
> = {
  classification: { icon: IconTag, label: "Classification" },
  document: { icon: IconFileText, label: "Document" },
  enforcement: { icon: IconShieldCheck, label: "Enforcement" },
  pga: { icon: IconShieldBreak, label: "PGA" },
  signoff: { icon: IconPageCheck, label: "Sign-off" },
  valuation: { icon: IconCurrencyDollar, label: "Valuation" },
};

export type DeadlineTone = "danger" | "default" | "warning";

export function deadlineTone(deadline: Date): DeadlineTone {
  const hoursLeft = differenceInHours(deadline, new Date());

  return hoursLeft <= 4 ? "danger" : hoursLeft <= 24 ? "warning" : "default";
}

function NoteTimelineItem({
  body,
  time = "just now",
  ...rest
}: { body: string; time?: string } & TimelineItemPassthrough) {
  return (
    <Timeline.Item align="start" status="default" {...rest}>
      <Timeline.Marker aria-hidden="true" className="size-6">
        <IconUser className="size-3.5" />
      </Timeline.Marker>
      <Timeline.Content className="gap-0.5">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <h3 className="text-foreground m-0 text-xs font-medium leading-5">
            You
          </h3>
          <time className="text-muted shrink-0 text-xs leading-5">{time}</time>
        </div>
        <p className="text-muted m-0 text-xs leading-5">{body}</p>
      </Timeline.Content>
    </Timeline.Item>
  );
}

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
              <IconArrowUp className="size-4" />
            </PromptInput.Send>
          </PromptInput.ToolbarEnd>
        </PromptInput.Toolbar>
      </PromptInput.Shell>
    </PromptInput>
  );
}

/** The full reasoning transcript — the Agent Trace tab. Runs render straight
 * from the canonical audit record. Multi-line reviews get a line selector —
 * each line has its own run. */
function TraceSection({
  item,
  onTraceLineChange,
  traceLine,
}: {
  item: ReviewItem;
  onTraceLineChange: (lineNumber: number) => void;
  traceLine: number | null;
}) {
  if (isMultiLineReview(item)) {
    const lines = item.lineItems ?? [];
    const active =
      lines.find((line) => line.lineNumber === traceLine) ??
      lines.find((line) => line.status === "needs_review") ??
      lines[0];
    const runIdForLine = Object.fromEntries(
      lines
        .filter((line) => line.runId)
        .map((line) => [line.lineNumber, line.runId as string]),
    );

    return (
      <LineTraceTabs
        activeLineNumber={active?.lineNumber}
        lines={lines}
        runIdForLine={runIdForLine}
        onSelect={onTraceLineChange}
      />
    );
  }
  if (item.traceRunId) {
    return <AgentRunTrace runId={item.traceRunId} />;
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted text-sm">
        No agent trace recorded for this review.
      </span>
      <div className="flex flex-col gap-1">
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
export interface NoteEntry {
  id: string;
  body: string;
  occurredAt: string;
}

export function ReviewDetail({
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
  onResolve: (
    action: DecisionAction,
    alternate?: string,
    corrections?: LineCorrection[],
  ) => void;
  position: number;
  total: number;
}) {
  const [alternate, setAlternate] = useState<string | null>(null);
  const [view, setView] = useState<"overview" | "trace">("overview");
  // Multi-line mode — every line carries its own classification detail, so
  // the overview aggregates and each line drills into a drawer.
  const multiLine = isMultiLineReview(item);
  /** Staged per-line substitutions: lineItemId → chosen alternate code. */
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const correctionEntries: LineCorrection[] = Object.entries(corrections).map(
    ([lineItemId, alternateValue]) => ({
      lineItemId,
      alternate: alternateValue,
    }),
  );
  const [openLine, setOpenLine] = useState<ReviewLineItem | null>(null);
  const [traceLine, setTraceLine] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
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
  // Latest memo wins — a re-classification supersedes earlier memos, so the
  // memo always matches the proposal shown on the decision card.
  const memoDocument = [...item.documents]
    .reverse()
    .find(
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
  // A drilled-into line's own rationale memo (memos are emitted per line);
  // the latest revision wins, mirroring the headline memo above.
  const memoForLine = (line: ReviewLineItem) =>
    [...item.documents]
      .reverse()
      .find(
        (document): document is ReviewDocument & { kind: "pdf" } =>
          document.kind === "pdf" &&
          isMemoDoc(document) &&
          new RegExp(`Line ${line.lineNumber}(\\D|$)`).test(document.name),
      );

  const handleAddNote = () => {
    const body = draft.trim();

    if (!body) return;
    setDraft("");
    onAddNote(body);
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
            <IconChevronLeft className="size-4" />
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
            onSelectionChange={(key) =>
              setView(key === "trace" ? "trace" : "overview")
            }
            size="sm"
          >
            <Segment.Item id="overview">Overview</Segment.Item>
            <Segment.Item id="trace">
              <IconSparklesThree className="size-3.5" />
              Agent trace
            </Segment.Item>
          </Segment>
          {total > 1 ? (
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
                <IconArrowLeft className="size-4" />
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
                <IconArrowRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Body — the title scrolls with the content. */}
      <ScrollShadow
        hideScrollBar
        className="min-h-0 flex-1 overflow-y-auto lg:px-4"
      >
        <div className="flex flex-col gap-1 pb-4">
          <h1 className="text-foreground text-base font-semibold leading-normal">
            {item.question}
          </h1>
          <span className="text-muted text-xs">
            {item.client} · {item.reference}
          </span>
        </div>
        {view === "overview" ? (
          <div className="flex select-text flex-col gap-4 pb-4">
            {/* Decision card — one proposal, or the all-lines aggregate */}
            {multiLine ? (
              <LineClassificationsCard
                corrections={corrections}
                lines={item.lineItems ?? []}
                onOpenLine={setOpenLine}
              />
            ) : (
              <Widget>
                <Widget.Header>
                  <Widget.Title>{item.proposal.label}</Widget.Title>
                  {memoDocument ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => setMemoOpen(true)}
                    >
                      <IconFileText className="size-3.5" />
                      View memo
                    </Button>
                  ) : null}
                </Widget.Header>
                <Widget.Content className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-foreground text-xl font-semibold tabular-nums tracking-tight">
                      {item.proposal.value}
                    </span>
                    <ConfidenceChip
                      confidence={item.confidence}
                      label="confident"
                      size="md"
                    />
                  </div>
                  <ClampedText text={item.proposal.detail} />
                  {/* One quiet meta row: the money, the evidence, the artifact. */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {item.dutyImpact ? (
                      <HoverCard closeDelay={100} openDelay={150}>
                        <HoverCard.Trigger className="inline-flex w-fit">
                          <span className="border-border-secondary inline-flex cursor-default items-baseline gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5">
                            <span className="text-foreground text-sm font-semibold tabular-nums">
                              Duty{" "}
                              {formatCurrency(
                                item.dutyImpact.proposed.amountUsd,
                              )}
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
                      <div className="flex flex-wrap items-center gap-1.5">
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
                    {responseDraft ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => setEditingDraft(responseDraft)}
                      >
                        <IconPencil className="size-3.5" />
                        Review response draft
                      </Button>
                    ) : null}
                  </div>
                </Widget.Content>
              </Widget>
            )}

            {/* Entry lines — every line's code at a glance; the reviewed
                line is highlighted. Multi-line mode folds these rows into
                the decision card above. */}
            {!multiLine && item.lineItems && item.lineItems.length > 0 ? (
              <Widget>
                <Widget.Header>
                  <Widget.Title>Line items</Widget.Title>
                </Widget.Header>
                <Widget.Content className="gap-0">
                  {item.lineItems.map((line) => {
                    const isReviewed =
                      line.lineNumber === item.reviewLineNumber;
                    return (
                      <div
                        key={line.lineItemId}
                        className={`flex items-center justify-between gap-3 border-b py-2 last:border-b-0 ${
                          isReviewed ? "bg-warning/5 -mx-2 rounded-md px-2" : ""
                        }`}
                      >
                        <div className="flex min-w-0 items-baseline gap-2">
                          <span className="text-muted shrink-0 text-xs tabular-nums">
                            #{line.lineNumber}
                          </span>
                          <div className="flex min-w-0 flex-col">
                            <span className="text-foreground truncate text-sm">
                              {line.description}
                            </span>
                            <span className="text-muted text-xs">
                              {[
                                line.quantity !== null
                                  ? `${line.quantity}${line.unit ? ` ${line.unit}` : ""}`
                                  : null,
                                line.valueUsd !== null
                                  ? formatCurrency(line.valueUsd)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {line.reused ? (
                            <Chip
                              className="bg-purple-100 text-purple-900"
                              size="sm"
                              variant="soft"
                            >
                              <Chip.Label>Reused</Chip.Label>
                            </Chip>
                          ) : null}
                          {line.confidence !== null ? (
                            <ConfidenceChip confidence={line.confidence} />
                          ) : null}
                          <span className="text-foreground font-mono text-sm tabular-nums">
                            {line.htsCode ?? "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </Widget.Content>
              </Widget>
            ) : null}

            {/* Alternates — their own card, out of the decision's way.
                Multi-line mode surfaces each line's own alternates in the
                line's drawer instead. */}
            {!multiLine && item.alternates && item.alternates.length > 0 ? (
              <Widget>
                <Widget.Header>
                  <Widget.Title>Alternate classifications</Widget.Title>
                </Widget.Header>
                <Widget.Content>
                  <AlternatesList
                    alternates={item.alternates}
                    deltaFor={(value) =>
                      item.dutyImpact?.alternates?.[value]?.deltaUsd
                    }
                    selected={alternate}
                    onSelect={setAlternate}
                  />
                </Widget.Content>
              </Widget>
            ) : null}

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
            <ShipmentFactsStrip shipment={item.shipment} />

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
                    <NoteTimelineItem
                      key={note.id}
                      _index={activity.length + index}
                      _isLast={false}
                      body={note.body}
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
                      <IconPencil className="size-3.5" />
                    </Timeline.Marker>
                    <Timeline.Content className="gap-2">
                      <Composer
                        placeholder="Add a comment..."
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
            <TraceSection
              item={item}
              traceLine={traceLine}
              onTraceLineChange={setTraceLine}
            />
          </div>
        )}
      </ScrollShadow>

      {/* Actions — pinned below the scroll area */}
      <div className="flex items-center justify-end gap-2 pt-0">
        {item.canRequestInfo ? (
          <Button variant="ghost" onPress={() => onResolve("info-requested")}>
            Request Info
          </Button>
        ) : null}
        {multiLine ? (
          <Button
            variant="primary"
            size="lg"
            onPress={() =>
              onResolve(
                correctionEntries.length ? "corrected" : "approved",
                undefined,
                correctionEntries.length ? correctionEntries : undefined,
              )
            }
          >
            <IconCircleCheck />
            {correctionEntries.length
              ? `Approve with ${correctionEntries.length} correction${correctionEntries.length === 1 ? "" : "s"}`
              : "Approve all lines"}
          </Button>
        ) : (
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
            <IconCircleCheck />
            {alternate ? `Approve ${alternate}` : item.approveLabel}
          </Button>
        )}
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
      {multiLine ? (
        <LineDetailDrawer
          line={openLine}
          memo={openLine ? (memoForLine(openLine) ?? null) : null}
          selectedAlternate={
            openLine ? (corrections[openLine.lineItemId] ?? null) : null
          }
          shipmentId={item.id}
          onOpenChange={(open) => {
            if (!open) setOpenLine(null);
          }}
          onSelectAlternate={(value) => {
            if (!openLine) return;
            setCorrections((current) => {
              if (value === null) {
                const { [openLine.lineItemId]: _, ...rest } = current;
                return rest;
              }
              return { ...current, [openLine.lineItemId]: value };
            });
          }}
        />
      ) : null}
    </div>
  );
}
