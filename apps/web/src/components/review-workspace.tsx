import {
  IconArrowLeft,
  IconCircleCheck,
  IconPencil,
  IconSquareArrowTopRight,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Avatar, Button, Chip, Skeleton, toast } from "@heroui/react";
import { EmptyState, Timeline, Widget } from "@heroui-pro/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { addHours, formatDistanceToNowStrict } from "date-fns";
import { useState } from "react";
import { AgentRunTrace } from "#/components/case-file/agent-run-trace";
import { AlternateClassificationsCard } from "#/components/case-file/alternate-classifications-card";
import { ComparisonCard } from "#/components/case-file/comparison-card";
import {
  DocumentsTimelineItem,
  SingleDocumentTimelineItem,
} from "#/components/case-file/document-items";
import { LineClassificationsCard } from "#/components/case-file/line-classifications-card";
import { LineTraceTabs } from "#/components/case-file/line-trace-tabs";
import type { LineSelection } from "#/components/case-file/line-workspace";
import { LineWorkspace } from "#/components/case-file/line-workspace";
import { ProposalCard } from "#/components/case-file/proposal-card";
import { ReviewActionsBar } from "#/components/case-file/review-actions-bar";
import {
  deadlineTextClass,
  deadlineTone,
  typeMeta,
} from "#/components/case-file/review-meta";
import { ShipmentFactsStrip } from "#/components/case-file/shipment-facts";
import {
  ActivitySkeleton,
  Composer,
  EventTimelineItem,
  NoteTimelineItem,
} from "#/components/case-file/timeline-items";
import { ResponseDraftModal } from "#/components/response-draft-modal";
import {
  getShipmentEventsControllerFindByShipmentQueryKey,
  useShipmentEventsControllerCreate,
  useShipmentsControllerFindOne,
  useShipmentsControllerResolve,
} from "#/generated/api";
import { BROKER_NOTE_TYPE } from "#/lib/event-kinds";
import { getInitials } from "#/lib/format";
import { buildShipmentReviewItem } from "#/lib/review-items";
import type {
  DecisionAction,
  LineCorrection,
  ReviewDocument,
} from "#/lib/review-types";
import {
  findLatestMemo,
  findResponseDraft,
  isMemoDocument,
  isMultiLineReview,
  isScreeningMemoDocument,
  isStandaloneDocument,
} from "#/lib/review-types";
import { useCaseFile } from "#/lib/use-case-file";
import { useReviewDecision } from "#/lib/use-review-decision";
import { useShipmentLines } from "#/lib/use-shipment-lines";

/* -------------------------------------------------------------------------------------------------
 * Review workspace — the focused decision page a queue row opens. Shows only
 * what the review type needs (agency determinations for PGA, the proposal /
 * alternates / corrections for classification), resolves, and returns to
 * the queue. The full shipment record stays one click away.
 * -----------------------------------------------------------------------------------------------*/

/** Poll cadence while the review is pending — picks up resolutions made
 * elsewhere (another tab, another broker) without a refresh. */
const REVIEW_POLL_MS = 10_000;

export function ReviewWorkspace({ shipmentId }: { shipmentId: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Poll only while the decision is pending, so a resolution made elsewhere
  // flips this page to its empty state without a refresh.
  const { data: shipmentResponse } = useShipmentsControllerFindOne(shipmentId, {
    query: {
      refetchInterval: (query) =>
        !query.state.data || query.state.data.data.status === "needs_review"
          ? REVIEW_POLL_MS
          : false,
    },
  });
  const shipment = shipmentResponse?.data;
  const inReview = shipment?.status === "needs_review";

  const caseFile = useCaseFile(shipmentId, inReview ? REVIEW_POLL_MS : false);
  const {
    lines,
    isLoaded: linesLoaded,
    runIdForLine,
    pgaRunIdForLine,
    activityByLine,
  } = useShipmentLines(shipmentId, false);

  const reviewItem =
    shipment && inReview && !caseFile.isPending
      ? buildShipmentReviewItem(shipment, caseFile)
      : null;
  // PGA mode — the decision is over the agency determinations; corrections
  // don't apply (approve / request-info only, the server 409s the rest).
  const isPgaReview = Boolean(
    reviewItem &&
      reviewItem.type === "pga" &&
      (reviewItem.pgaAgencies?.length ?? 0) > 0,
  );
  // Multi-line mode gates on the payload's enriched line shape — and never
  // for PGA, whose live lines all carry duty.
  const multiLine = Boolean(
    reviewItem && reviewItem.type !== "pga" && isMultiLineReview(reviewItem),
  );
  const decision = useReviewDecision();
  const reviewDeadline = shipment?.reviewDeadlineAt
    ? new Date(shipment.reviewDeadlineAt)
    : addHours(new Date(), 24);
  const reviewTone = deadlineTone(reviewDeadline);

  const memoDocument = findLatestMemo(caseFile.documents);
  const responseDraft = findResponseDraft(caseFile.documents);
  const [editingDraft, setEditingDraft] = useState<
    (ReviewDocument & { kind: "pdf" }) | null
  >(null);
  const [isMemoOpen, setMemoOpen] = useState(false);

  // The line workspace's selection during multi-line reviews. (The route
  // keys this component by shipmentId, so it resets per item.)
  const [selectedLine, setSelectedLine] = useState<LineSelection>("overview");
  const jumpToTrace = () => {
    const runMap = isPgaReview ? pgaRunIdForLine : runIdForLine;
    const target =
      lines.find((line) => runMap[line.lineNumber])?.lineNumber ??
      lines[0]?.lineNumber;

    if (target !== undefined) setSelectedLine(target);
  };

  // Agent trace for single-line reviews (PGA and multi-line reviews carry
  // their traces inside the line workspace's per-line tabs). The payload's
  // line runIds back-fill lines the runs list hasn't loaded yet.
  const [traceLine, setTraceLine] = useState<number | null>(null);
  const traceLines = lines.length > 0 ? lines : (reviewItem?.lineItems ?? []);
  const payloadRunIdForLine: Record<number, string> = {};

  for (const line of reviewItem?.lineItems ?? []) {
    if (line.runId) payloadRunIdForLine[line.lineNumber] = line.runId;
  }
  const traceRunIdForLine = { ...payloadRunIdForLine, ...runIdForLine };
  const activeTraceLine =
    traceLine ??
    reviewItem?.reviewLineNumber ??
    traceLines.find((line) => traceRunIdForLine[line.lineNumber])?.lineNumber ??
    traceLines[0]?.lineNumber;

  const resolveReview = useShipmentsControllerResolve();
  const handleResolve = (
    action: DecisionAction,
    alternate?: string,
    corrections?: LineCorrection[],
  ) => {
    if (!shipment) return;
    const reference = shipment.reference;
    // Everything shipment-shaped: the list, stats, the global event feed,
    // and per-shipment timelines all live under /v1/shipments.
    const invalidateShipments = () =>
      queryClient.invalidateQueries({
        predicate: (query) =>
          String(query.queryKey[0]).startsWith("/v1/shipments"),
      });
    const run = resolveReview
      .mutateAsync({
        id: shipmentId,
        data: {
          action: action === "info-requested" ? "info_requested" : action,
          ...(alternate && { alternate }),
          ...(corrections?.length && { corrections }),
        },
      })
      .then(async () => {
        decision.reset();
        await invalidateShipments();
        // Gmail model: a decision archives the item and returns to the
        // queue. Info requests keep the item pending, so stay put.
        if (action !== "info-requested") {
          navigate({ to: "/dashboard/review" });
        }
      })
      .catch(async (error) => {
        // A 409 means it was resolved elsewhere — the refetch flips this
        // page to its no-pending-review state on its own.
        await invalidateShipments();
        throw error;
      });

    toast.promise(run, {
      error: "Failed to resolve review — it may have been resolved elsewhere",
      loading: "Resolving review...",
      success:
        action === "approved"
          ? `Approved ${reference}`
          : action === "corrected"
            ? corrections?.length
              ? `Corrected ${reference} — ${corrections.length} line${corrections.length === 1 ? "" : "s"}`
              : `Corrected ${reference} → ${alternate}`
            : `Requested more info for ${reference}`,
    });
  };

  // Broker notes ride the audit record as events.
  const createEvent = useShipmentEventsControllerCreate();
  const [noteDraft, setNoteDraft] = useState("");
  const handleAddNote = () => {
    const body = noteDraft.trim();

    if (!body) return;
    setNoteDraft("");
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

  // The intake documents (invoice, packing list, B/L, spec…) collapse into
  // ONE tab-switched timeline beat anchored at the earliest one — the
  // evidence the decision rests on. CBP correspondence and drafted
  // responses keep their own slots; rationale and screening memos are
  // internal work product that opens from the decision cards instead.
  const intakeDocuments = caseFile.documents.filter(
    (document) =>
      !isStandaloneDocument(document) &&
      !isMemoDocument(document) &&
      !isScreeningMemoDocument(document),
  );

  // The record: the document set, correspondence beats, activity events, and
  // broker notes — oldest first, composer at the end.
  const railEntries = [
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
    ...caseFile.activityEvents.map((event) => ({
      event,
      hoursAgo: event.occurredHoursAgo,
      kind: "event" as const,
    })),
    ...caseFile.documents
      .filter(
        (document) =>
          document.kind !== "email" && isStandaloneDocument(document),
      )
      .map((document) => ({
        document,
        hoursAgo: document.receivedHoursAgo,
        kind: "document" as const,
      })),
    ...caseFile.notes.map((note) => ({
      hoursAgo: (Date.now() - new Date(note.occurredAt).getTime()) / 3_600_000,
      kind: "note" as const,
      note,
    })),
  ].sort((a, b) => b.hoursAgo - a.hoursAgo);

  const TypeIcon = reviewItem ? typeMeta[reviewItem.type].icon : null;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          isIconOnly
          aria-label="Back to queue"
          size="sm"
          variant="ghost"
          onPress={() =>
            router.history.canGoBack()
              ? router.history.back()
              : navigate({ to: "/dashboard/review" })
          }
        >
          <IconArrowLeft className="size-4" />
        </Button>
        {shipment ? (
          <>
            <Avatar size="md">
              <Avatar.Image src={shipment.client?.image ?? undefined} />
              <Avatar.Fallback>
                {getInitials(shipment.client?.name)}
              </Avatar.Fallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground truncate text-base font-semibold">
                {shipment.client?.name ?? "Unknown client"}
              </span>
              <span className="text-muted truncate text-xs">
                {shipment.reference}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
        )}
      </div>
      {shipment ? (
        <Button
          isIconOnly
          aria-label="Open shipment"
          size="sm"
          variant="ghost"
          onPress={() =>
            navigate({
              params: { shipmentId },
              to: "/dashboard/shipments/$shipmentId",
            })
          }
        >
          <IconSquareArrowTopRight className="size-4" />
        </Button>
      ) : null}
    </div>
  );

  // Nothing to decide — resolved elsewhere, a stale link, or just resolved.
  if (shipment && !inReview) {
    return (
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4">
        {header}
        <div className="flex items-center justify-center rounded-2xl border px-6 py-16">
          <EmptyState size="sm">
            <EmptyState.Header>
              <EmptyState.Media className="border" variant="icon">
                <IconCircleCheck />
              </EmptyState.Media>
              <EmptyState.Title>No pending review</EmptyState.Title>
              <EmptyState.Description>
                This shipment doesn't need a decision right now — it may have
                just been resolved.
              </EmptyState.Description>
            </EmptyState.Header>
            <EmptyState.Content className="flex-row gap-2">
              <Button
                variant="ghost"
                onPress={() => navigate({ to: "/dashboard/review" })}
              >
                Back to queue
              </Button>
              <Button
                variant="outline"
                onPress={() =>
                  navigate({
                    params: { shipmentId },
                    to: "/dashboard/shipments/$shipmentId",
                  })
                }
              >
                <IconSquareArrowTopRight />
                Open shipment
              </Button>
            </EmptyState.Content>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4">
      {header}

      {/* The question being asked of the broker */}
      {reviewItem && TypeIcon ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip size="sm" variant="soft">
              <TypeIcon className="size-3" />
              <Chip.Label>{typeMeta[reviewItem.type].label}</Chip.Label>
            </Chip>
            {reviewItem.noticeForm ? (
              <Chip color="danger" size="sm" variant="soft">
                <Chip.Label className="font-semibold">
                  {reviewItem.noticeForm}
                </Chip.Label>
              </Chip>
            ) : null}
            <Chip
              color={reviewTone === "default" ? "default" : reviewTone}
              size="sm"
              variant="soft"
            >
              <Chip.Label>
                {formatDistanceToNowStrict(reviewDeadline, {
                  addSuffix: true,
                })}
              </Chip.Label>
            </Chip>
          </div>
          <h1 className="text-foreground m-0 text-lg font-semibold leading-normal">
            {reviewItem.question}
          </h1>
          {reviewItem.deadlineReason ? (
            <span className="text-muted text-xs">
              {reviewItem.deadlineReason}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-56 rounded-full" />
          <Skeleton className="h-7 w-2/3 rounded" />
        </div>
      )}

      {reviewItem ? (
        <>
          {/* Decision content — only what this review type needs. PGA and
              multi-line reviews share the line workspace: a simple overview
              on top, then one comprehensive tab per line (classification,
              determinations, memos, traces). */}
          {isPgaReview || multiLine ? (
            <LineWorkspace
              activityByLine={activityByLine}
              corrections={multiLine ? decision.corrections : undefined}
              documents={caseFile.documents}
              emphasis={isPgaReview ? "screening" : "classification"}
              flagTableVersion={reviewItem.flagTableVersion}
              lines={lines}
              linesLoaded={linesLoaded}
              pgaAgencies={reviewItem.pgaAgencies}
              pgaRunIdForLine={pgaRunIdForLine}
              processing={null}
              runIdForLine={runIdForLine}
              screening={false}
              selected={selectedLine}
              shipmentId={shipmentId}
              traceRunId={reviewItem.traceRunId}
              onSelect={setSelectedLine}
              onStageCorrection={
                multiLine ? decision.stageCorrection : undefined
              }
            />
          ) : (
            <>
              <ProposalCard
                item={reviewItem}
                onViewDraft={
                  responseDraft
                    ? () => setEditingDraft(responseDraft)
                    : undefined
                }
                onViewMemo={memoDocument ? () => setMemoOpen(true) : undefined}
              />
              {reviewItem.alternates?.length ? (
                <AlternateClassificationsCard
                  alternates={reviewItem.alternates}
                  deltaFor={(value) =>
                    reviewItem.dutyImpact?.alternates?.[value]?.deltaUsd
                  }
                  selected={decision.alternate}
                  onSelect={decision.setAlternate}
                />
              ) : null}
              {lines.length > 0 || (reviewItem.lineItems?.length ?? 0) > 0 ? (
                <LineClassificationsCard
                  isLoading={!linesLoaded && !reviewItem.lineItems?.length}
                  lines={
                    lines.length > 0 ? lines : (reviewItem.lineItems ?? [])
                  }
                />
              ) : null}
            </>
          )}
          {reviewItem.comparison ? (
            <ComparisonCard comparison={reviewItem.comparison} />
          ) : null}

          {/* Agent trace — how the AI reached the answer being reviewed.
              PGA and multi-line reviews carry traces inside the line
              workspace's per-line tabs instead. */}
          {!multiLine && !isPgaReview ? (
            <Widget>
              <Widget.Header>
                <Widget.Title>Agent trace</Widget.Title>
              </Widget.Header>
              <Widget.Content>
                {traceLines.length > 0 &&
                Object.keys(traceRunIdForLine).length > 0 ? (
                  <LineTraceTabs
                    activeLineNumber={activeTraceLine}
                    lines={traceLines}
                    runIdForLine={traceRunIdForLine}
                    onSelect={setTraceLine}
                  />
                ) : reviewItem.traceRunId ? (
                  <AgentRunTrace runId={reviewItem.traceRunId} />
                ) : (
                  <span className="text-muted text-sm">
                    No agent trace recorded for this review.
                  </span>
                )}
              </Widget.Content>
            </Widget>
          ) : null}

          {/* Shipment — one scannable strip */}
          <ShipmentFactsStrip shipment={reviewItem.shipment} />

          {/* Activity — documents, events, and notes to the record */}
          <div className="flex flex-col gap-2">
            <span className="text-muted text-xs font-medium">Activity</span>
            {caseFile.isPending ? (
              <ActivitySkeleton />
            ) : (
              <Timeline density="comfortable" size="sm">
                {railEntries.map((entry, index) =>
                  entry.kind === "documents" ? (
                    <DocumentsTimelineItem
                      key="documents"
                      documents={entry.documents}
                      onEditDraft={(document) => setEditingDraft(document)}
                    />
                  ) : entry.kind === "event" ? (
                    <EventTimelineItem
                      // biome-ignore lint/suspicious/noArrayIndexKey: events have no stable id in this projection
                      key={`event-${index}`}
                      event={entry.event}
                      onViewMemo={
                        memoDocument ? () => setMemoOpen(true) : undefined
                      }
                      onViewTrace={
                        multiLine || isPgaReview ? jumpToTrace : undefined
                      }
                    />
                  ) : entry.kind === "document" ? (
                    <SingleDocumentTimelineItem
                      key={
                        entry.document.kind === "email"
                          ? entry.document.subject
                          : entry.document.name
                      }
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
                    <NoteTimelineItem
                      key={entry.note.id}
                      body={entry.note.body}
                      time={formatDistanceToNowStrict(
                        new Date(entry.note.occurredAt),
                        { addSuffix: true },
                      )}
                    />
                  ),
                )}
                <Timeline.Item align="start" status="default">
                  <Timeline.Marker aria-hidden="true" className="size-6">
                    <IconPencil className="size-3.5" />
                  </Timeline.Marker>
                  <Timeline.Content className="gap-2">
                    <Composer
                      placeholder="Add a comment..."
                      value={noteDraft}
                      onSubmit={handleAddNote}
                      onValueChange={setNoteDraft}
                    />
                  </Timeline.Content>
                </Timeline.Item>
              </Timeline>
            )}
          </div>
        </>
      ) : (
        <Skeleton className="h-64 rounded-2xl" />
      )}

      {/* Decision bar — pinned so the actions stay in reach */}
      {reviewItem ? (
        <div className="bg-background/85 sticky bottom-4 z-10 mx-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur">
          <span
            className={`px-2 text-xs ${
              decision.correctionEntries.length > 0
                ? "text-muted"
                : deadlineTextClass[reviewTone]
            }`}
          >
            {decision.correctionEntries.length > 0
              ? `${decision.correctionEntries.length} correction${decision.correctionEntries.length === 1 ? "" : "s"} staged`
              : `Review due ${formatDistanceToNowStrict(reviewDeadline, { addSuffix: true })}`}
          </span>
          <ReviewActionsBar
            alternate={decision.alternate}
            approveLabel={reviewItem.approveLabel}
            canRequestInfo={reviewItem.canRequestInfo}
            correctionEntries={decision.correctionEntries}
            isResolving={resolveReview.isPending}
            multiLine={multiLine}
            onResolve={handleResolve}
          />
        </div>
      ) : null}

      <ResponseDraftModal
        document={editingDraft}
        isOpen={Boolean(editingDraft)}
        shipmentId={shipmentId}
        onOpenChange={(open) => {
          if (!open) setEditingDraft(null);
        }}
      />
      {memoDocument ? (
        <ResponseDraftModal
          readOnly
          document={memoDocument}
          isOpen={isMemoOpen}
          shipmentId={shipmentId}
          onOpenChange={setMemoOpen}
        />
      ) : null}
    </div>
  );
}
