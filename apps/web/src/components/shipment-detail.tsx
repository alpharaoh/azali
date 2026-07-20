import {
  IconArrowLeft,
  IconExclamationCircle,
  IconFileText,
  IconPencil,
  IconSquareArrowTopRight,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Avatar, Button, Chip, Skeleton, Spinner, toast } from "@heroui/react";
import { TextShimmer, Timeline, Widget } from "@heroui-pro/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { addHours, formatDistanceToNowStrict } from "date-fns";
import { useState } from "react";
import { AlternateClassificationsCard } from "#/components/case-file/alternate-classifications-card";
import { ComparisonCard } from "#/components/case-file/comparison-card";
import { SingleDocumentTimelineItem } from "#/components/case-file/document-items";
import { DocumentViewerModal } from "#/components/case-file/document-viewer-modal";
import type { LineSelection } from "#/components/case-file/line-workspace";
import { LineWorkspace } from "#/components/case-file/line-workspace";
import { ProposalCard } from "#/components/case-file/proposal-card";
import { ReviewActionsBar } from "#/components/case-file/review-actions-bar";
import {
  deadlineTextClass,
  deadlineTone,
  typeMeta,
} from "#/components/case-file/review-meta";
import {
  ShipmentFactsCard,
  ShipmentFactsCardSkeleton,
} from "#/components/case-file/shipment-facts";
import {
  ActivitySkeleton,
  Composer,
  EventTimelineItem,
  NoteTimelineItem,
} from "#/components/case-file/timeline-items";
import {
  priorityFor,
  StageTracker,
  statusFromApi,
  statusMeta,
} from "#/components/pipeline-board";
import { ResponseDraftModal } from "#/components/response-draft-modal";
import type { ListShipmentDocumentsResponseDtoDocumentsItem } from "#/generated/api";
import {
  getShipmentEventsControllerFindByShipmentQueryKey,
  getShipmentsControllerFindOneQueryKey,
  useShipmentDocumentsControllerList,
  useShipmentEventsControllerCreate,
  useShipmentsControllerFindOne,
  useShipmentsControllerResolve,
  useShipmentsControllerSkipEmailIntake,
} from "#/generated/api";
import { BROKER_NOTE_TYPE } from "#/lib/event-kinds";
import { buildShipmentReviewItem, toShipmentFacts } from "#/lib/review-items";
import type {
  DecisionAction,
  DocumentLine,
  LineCorrection,
  ReviewDocument,
} from "#/lib/review-types";
import {
  findLatestMemo,
  findResponseDraft,
  isMultiLineReview,
  isStandaloneDocument,
} from "#/lib/review-types";
import { PROCESSING_POLL_MS, useCaseFile } from "#/lib/use-case-file";
import { useReviewDecision } from "#/lib/use-review-decision";
import { useShipmentLines } from "#/lib/use-shipment-lines";

/* -------------------------------------------------------------------------------------------------
 * Per-shipment detail page — fully usable WHILE the pipeline is processing:
 * documents appear as they extract, lines as they classify, and the agent
 * trace fills in live (polled while the pipeline runs). When the pipeline
 * flags the shipment for review, the page IS the review surface: the
 * question, the decision cards, and the approve/correct actions all live
 * here. Once settled it reads as the shipment's standing record.
 * -----------------------------------------------------------------------------------------------*/

/** Poll cadence while a review is pending — picks up resolutions made
 * elsewhere (another tab, another broker) without a refresh. */
const REVIEW_POLL_MS = 10_000;

/** Adapt an API document row to the shape the shared viewer renders. */
function toViewerDocument(
  document: ListShipmentDocumentsResponseDtoDocumentsItem,
): ReviewDocument & { kind: "pdf"; src?: string } {
  return {
    kind: "pdf",
    name: document.fileName,
    meta: `${document.category.replace(/_/g, " ")}${
      document.pageCount
        ? ` · ${document.pageCount} page${document.pageCount === 1 ? "" : "s"}`
        : ""
    }`,
    receivedHoursAgo:
      (Date.now() - new Date(document.createdAt).getTime()) / 3_600_000,
    lines: (document.extraction?.fields ?? []) as DocumentLine[],
    summary: document.extraction?.summary ?? undefined,
    src: document.fileUrl,
    previewUrl: document.previewUrl,
  };
}

/** One document tile — first-page preview on a soft mat, hover to view. */
function DocumentPreviewCard({
  document,
  onOpen,
}: {
  document: ListShipmentDocumentsResponseDtoDocumentsItem;
  onOpen: () => void;
}) {
  const [isPreviewLoaded, setPreviewLoaded] = useState(false);
  const pending = document.status === "pending";

  return (
    <button
      className="group flex flex-col gap-2 text-left"
      type="button"
      onClick={onOpen}
    >
      <div className="bg-default/40 relative flex h-44 w-full items-center justify-center overflow-hidden rounded-lg border p-1">
        {document.previewUrl ? (
          <>
            {!isPreviewLoaded && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Spinner aria-label="Loading document preview" size="sm" />
              </span>
            )}
            <img
              alt=""
              aria-hidden
              className={`pointer-events-none h-full max-h-full w-auto max-w-full rounded-sm bg-white object-contain object-top shadow-sm transition-opacity duration-200 ${
                isPreviewLoaded ? "opacity-100" : "opacity-0"
              }`}
              src={document.previewUrl}
              onLoad={() => setPreviewLoaded(true)}
            />
          </>
        ) : (
          <IconFileText className="text-muted size-8" />
        )}
        {document.pageCount ? (
          <span className="bg-background/80 text-muted absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums backdrop-blur-sm">
            1 of {document.pageCount}
          </span>
        ) : null}
        {pending ? (
          <span className="bg-background/70 absolute inset-0 flex items-center justify-center gap-1.5 backdrop-blur-[2px]">
            <Spinner size="sm" />
            <TextShimmer className="text-xs">Reading…</TextShimmer>
          </span>
        ) : (
          <span className="bg-background/70 absolute inset-0 flex items-center justify-center opacity-0 backdrop-blur-[2px] transition-opacity duration-150 group-hover:opacity-100">
            <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
              <IconSquareArrowTopRight className="size-3.5" />
              View document
            </span>
          </span>
        )}
        {document.status === "failed" ? (
          <Chip
            className="absolute left-2 top-2"
            color="danger"
            size="sm"
            variant="soft"
          >
            <Chip.Label>Extraction failed</Chip.Label>
          </Chip>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col px-0.5">
        <span className="text-foreground truncate text-sm font-medium">
          {document.fileName}
        </span>
        <span className="text-muted truncate text-xs">
          {document.category.replace(/_/g, " ")}
          {document.pageCount
            ? ` · ${document.pageCount} page${document.pageCount === 1 ? "" : "s"}`
            : ""}
        </span>
      </div>
    </button>
  );
}

export function ShipmentDetail({ shipmentId }: { shipmentId: string }) {
  const navigate = useNavigate();
  const router = useRouter();

  // The row self-gates its poll: fast while it's processing (or not yet
  // loaded), review cadence while a broker decision is pending, off once
  // settled.
  const { data: shipmentResponse } = useShipmentsControllerFindOne(shipmentId, {
    query: {
      refetchInterval: (query) => {
        const row = query.state.data?.data;

        if (!row || row.processingState !== null) return PROCESSING_POLL_MS;
        if (row.status === "needs_review") return REVIEW_POLL_MS;
        return false;
      },
    },
  });
  const shipment = shipmentResponse?.data;
  const processing = shipment?.processingState ?? null;
  const inReview = shipment?.status === "needs_review";
  const poll =
    processing !== null
      ? PROCESSING_POLL_MS
      : inReview
        ? REVIEW_POLL_MS
        : false;

  // Broker fast-forward for email-sourced shipments: stop collecting
  // related emails and classify with what's already here.
  const queryClient = useQueryClient();
  const skipIntake = useShipmentsControllerSkipEmailIntake();
  const awaitingEmails = processing === "Waiting for related emails";
  const handleSkipIntake = () => {
    const run = skipIntake.mutateAsync({ id: shipmentId }).then(async () => {
      await queryClient.invalidateQueries({
        queryKey: getShipmentsControllerFindOneQueryKey(shipmentId),
      });
    });
    toast.promise(run, {
      error: "Could not skip the wait",
      loading: "Skipping the wait...",
      success: "Starting classification",
    });
  };

  const { data: documentsResponse } = useShipmentDocumentsControllerList(
    shipmentId,
    { query: { refetchInterval: poll } },
  );
  const caseFile = useCaseFile(shipmentId, poll);
  const documents = documentsResponse?.data.documents;

  // The lines endpoint is the single source of per-line truth; the hook
  // layers on the run map from the runs list, polled while processing.
  const {
    lines,
    isLoaded: linesLoaded,
    runIdForLine,
    pgaRunIdForLine,
    activityByLine,
  } = useShipmentLines(shipmentId, processing !== null);

  /* ---------------------------------------------------------------------------------------------
   * Review surface — the pending review's framing (from the shipment's own
   * review_requested event) plus the staged decision. Everything unmounts
   * the moment the status leaves needs_review.
   * -------------------------------------------------------------------------------------------*/
  const reviewItem =
    shipment && inReview && !caseFile.isPending
      ? buildShipmentReviewItem(shipment, caseFile)
      : null;
  // PGA mode — the decision card is the agency determinations; corrections
  // don't apply (approve / request-info only, the server 409s the rest).
  const isPgaReview = Boolean(
    reviewItem &&
      reviewItem.type === "pga" &&
      (reviewItem.pgaAgencies?.length ?? 0) > 0,
  );
  // Multi-line mode gates on the payload's enriched line shape, exactly as
  // the queue did — and never for PGA, whose live lines all carry duty.
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
      })
      .catch(async (error) => {
        // A 409 means it was resolved elsewhere — the refetch flips the
        // status and the review surface unmounts on its own.
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

  // Broker notes ride the audit record as events, review or not.
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

  // Full-document viewer (real PDF + the AI's reading).
  const [viewerDocument, setViewerDocument] = useState<
    (ReviewDocument & { kind: "pdf"; src?: string }) | null
  >(null);

  // The line workspace's selection — Overview or one line's whole story.
  // (The route keys this component by shipmentId, so it resets per shipment.)
  const [selectedLine, setSelectedLine] = useState<LineSelection>("overview");
  // "View agent trace" from the activity rail lands on the first line with
  // an audit run — the trace lives inside that line's tab now.
  const jumpToTrace = () => {
    const target =
      lines.find((line) => runIdForLine[line.lineNumber])?.lineNumber ??
      lines[0]?.lineNumber;

    if (target !== undefined) setSelectedLine(target);
  };

  // Screening state, straight from the processing message the workflow sets.
  const screening = /screening/i.test(processing ?? "");

  // The running record: activity events, CBP correspondence and drafted
  // responses as their own beats, and broker notes — oldest first, so the
  // record reads top-down and the latest beat sits by the composer. (Emails
  // already arrive through the activity merge.)
  const railEntries = [
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

  const ReviewTypeIcon = reviewItem ? typeMeta[reviewItem.type].icon : null;

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-4">
      {/* Header — identity + pipeline progress left, live state far right */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Button
            isIconOnly
            aria-label="Back"
            size="sm"
            variant="ghost"
            onPress={() =>
              router.history.canGoBack()
                ? router.history.back()
                : navigate({ to: "/dashboard/pipeline" })
            }
          >
            <IconArrowLeft className="size-4" />
          </Button>
          {shipment ? (
            <>
              <Avatar size="md">
                <Avatar.Image src={shipment.client?.image ?? undefined} />
                <Avatar.Fallback>
                  {(shipment.client?.name ?? "?").slice(0, 2).toUpperCase()}
                </Avatar.Fallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="text-foreground truncate text-base font-semibold">
                  {shipment.reference}
                </span>
                <span className="text-muted truncate text-xs">
                  {shipment.client?.name ?? "Resolving importer…"}
                </span>
              </div>
              <div className="ml-3 border-l pl-6">
                <StageTracker
                  stage={shipment.stage}
                  status={statusFromApi[shipment.status]}
                  priority={priorityFor(
                    shipment.stage,
                    statusFromApi[shipment.status],
                    shipment.etaAt
                      ? (new Date(shipment.etaAt).getTime() - Date.now()) /
                          3_600_000
                      : null,
                    shipment.valueCents / 100,
                  )}
                />
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
        {processing ? (
          <div className="flex items-center gap-2">
            <Chip color="accent" size="md" variant="soft">
              <Chip.Label className="inline-flex items-center gap-2 h-5.25">
                <Spinner size="sm" />
                <TextShimmer className="text-xs">{processing}</TextShimmer>
              </Chip.Label>
            </Chip>
            {awaitingEmails ? (
              <Button
                isPending={skipIntake.isPending}
                size="sm"
                variant="secondary"
                onPress={handleSkipIntake}
              >
                Skip waiting
              </Button>
            ) : null}
          </div>
        ) : shipment ? (
          <Chip
            color={statusMeta[statusFromApi[shipment.status]].chip}
            size="md"
            variant="soft"
          >
            <Chip.Label>
              {statusMeta[statusFromApi[shipment.status]].label}
            </Chip.Label>
          </Chip>
        ) : (
          <Skeleton className="h-7 w-32 rounded-full" />
        )}
      </div>

      {/* Review band — the question being asked of the broker. The page IS
          the review: the decision cards sit below, the actions bar is
          pinned at the bottom. */}
      {inReview ? (
        reviewItem && ReviewTypeIcon ? (
          <div className="border-warning/40 bg-warning/5 flex flex-col gap-2 rounded-2xl border p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip size="sm" variant="soft">
                <ReviewTypeIcon className="size-3" />
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
            <h2 className="text-foreground m-0 text-base font-semibold leading-normal">
              {reviewItem.question}
            </h2>
            {reviewItem.deadlineReason ? (
              <span className="text-muted text-xs">
                {reviewItem.deadlineReason}
              </span>
            ) : null}
          </div>
        ) : (
          <Skeleton className="h-24 rounded-2xl" />
        )
      ) : null}

      {/* Failure surface — ingest/classification failures land on the timeline */}
      {caseFile.activityEvents.some((event) =>
        /processing failed|classification failed/i.test(event.title),
      ) ? (
        <div className="border-danger/40 bg-danger/5 flex items-center gap-2 rounded-xl border p-3">
          <IconExclamationCircle className="text-danger size-4" />
          <span className="text-foreground text-sm">
            Processing hit a failure — see the activity timeline for details.
          </span>
        </div>
      ) : null}

      {/* Main content left, the shipment's running record on the right */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Decision cards — the headline proposal with its alternates.
              Multi-line reviews stage corrections inside the line workspace;
              PGA reviews decide over the workspace's agency determinations. */}
          {reviewItem && !isPgaReview && !multiLine ? (
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
            </>
          ) : null}
          {reviewItem?.comparison ? (
            <ComparisonCard comparison={reviewItem.comparison} />
          ) : null}

          {/* The line workspace — Overview across every line, then one tab
              per line gathering its classification, agency determinations,
              memos, and both agent traces. During a multi-line review the
              per-line alternates stage corrections. The documents card
              (preview tiles → full viewer) rides on the Overview tab. */}
          <LineWorkspace
            activityByLine={activityByLine}
            awaitingEmails={awaitingEmails}
            corrections={multiLine ? decision.corrections : undefined}
            documents={caseFile.documents}
            documentsSlot={
              <Widget className="min-w-0">
                <Widget.Header>
                  <Widget.Title>
                    Documents
                    {documents?.length ? ` (${documents.length})` : ""}
                  </Widget.Title>
                </Widget.Header>
                <Widget.Content>
                  {documents === undefined ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Skeleton className="h-44 rounded-lg" />
                      <Skeleton className="h-44 rounded-lg" />
                      <Skeleton className="h-44 rounded-lg" />
                    </div>
                  ) : documents.length === 0 ? (
                    <span className="text-muted text-sm">
                      {processing
                        ? "Registering uploaded documents…"
                        : "No documents on file."}
                    </span>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {documents.map((document) => (
                        <DocumentPreviewCard
                          key={document.id}
                          document={document}
                          onOpen={() =>
                            setViewerDocument(toViewerDocument(document))
                          }
                        />
                      ))}
                    </div>
                  )}
                </Widget.Content>
              </Widget>
            }
            flagTableVersion={caseFile.reviewRequest?.flagTableVersion}
            lines={lines}
            linesLoaded={linesLoaded}
            pgaAgencies={caseFile.reviewRequest?.pgaAgencies}
            pgaRunIdForLine={pgaRunIdForLine}
            processing={processing}
            runIdForLine={runIdForLine}
            screening={screening}
            selected={selectedLine}
            shipmentId={shipmentId}
            traceRunId={caseFile.traceRunId}
            onSelect={setSelectedLine}
            onStageCorrection={multiLine ? decision.stageCorrection : undefined}
          />
        </div>

        {/* Information column — the shipment's facts, then its running record */}
        <div className="flex min-w-0 flex-col gap-4">
          {shipment ? (
            <ShipmentFactsCard shipment={toShipmentFacts(shipment)} />
          ) : (
            <ShipmentFactsCardSkeleton />
          )}

          <Widget className="min-w-0">
            <Widget.Header>
              <Widget.Title>Activity</Widget.Title>
            </Widget.Header>
            <Widget.Content>
              {caseFile.isPending ? (
                <ActivitySkeleton />
              ) : (
                <div className="flex flex-col gap-3">
                  {railEntries.length === 0 ? (
                    <span className="text-muted text-sm">
                      {processing
                        ? "The record starts as soon as extraction lands…"
                        : "No activity recorded yet."}
                    </span>
                  ) : null}
                  <Timeline>
                    {railEntries.map((entry, index) =>
                      entry.kind === "event" ? (
                        <EventTimelineItem
                          // biome-ignore lint/suspicious/noArrayIndexKey: events have no stable id in this projection
                          key={`event-${index}`}
                          event={entry.event}
                          onViewMemo={
                            memoDocument ? () => setMemoOpen(true) : undefined
                          }
                          onViewTrace={jumpToTrace}
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
                            entry.document.kind === "pdf" &&
                            entry.document.draft
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
                    {/* The broker's line into the audit record — always on,
                        pinned after the latest beat. */}
                    <Timeline.Item align="start" status="default">
                      <Timeline.Marker aria-hidden="true" className="size-6">
                        <IconPencil className="size-3.5" />
                      </Timeline.Marker>
                      <Timeline.Content className="gap-2">
                        <Composer
                          placeholder="Add a note to the record..."
                          value={noteDraft}
                          onSubmit={handleAddNote}
                          onValueChange={setNoteDraft}
                        />
                      </Timeline.Content>
                    </Timeline.Item>
                  </Timeline>
                </div>
              )}
            </Widget.Content>
          </Widget>
        </div>
      </div>

      {/* Decision bar — pinned while a review is pending, so the actions
          stay in reach however deep the record scrolls. */}
      {reviewItem ? (
        <div className="bg-background/85 sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur">
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

      {viewerDocument ? (
        <DocumentViewerModal
          document={viewerDocument}
          isOpen={Boolean(viewerDocument)}
          onOpenChange={(open) => {
            if (!open) setViewerDocument(null);
          }}
        />
      ) : null}
    </div>
  );
}
