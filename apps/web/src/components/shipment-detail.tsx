import {
  ArrowLeft,
  ArrowUpRightFromSquare,
  CircleExclamation,
  FileText,
  ShieldExclamation,
  Sparkles,
} from "@gravity-ui/icons";
import { Avatar, Button, Chip, Skeleton, Spinner, Tabs } from "@heroui/react";
import { TextShimmer, Timeline, Widget } from "@heroui-pro/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DocumentViewerModal } from "#/components/case-file/document-viewer-modal";
import { LineClassificationsCard } from "#/components/case-file/line-classifications-card";
import { LineDetailDrawer } from "#/components/case-file/line-detail-drawer";
import { LineTraceTabs } from "#/components/case-file/line-trace-tabs";
import {
  ActivitySkeleton,
  EventTimelineItem,
} from "#/components/case-file/timeline-items";
import {
  StageTracker,
  statusFromApi,
  statusMeta,
} from "#/components/pipeline-board";
import { clientLogos } from "#/data/client-logos";
import type { ListShipmentDocumentsResponseDtoDocumentsItem } from "#/generated/api";
import {
  useShipmentDocumentsControllerList,
  useShipmentsControllerFindOne,
} from "#/generated/api";
import type {
  DocumentLine,
  ReviewDocument,
  ReviewLineItem,
} from "#/lib/review-types";
import { findLineMemo } from "#/lib/review-types";
import { useCaseFile } from "#/lib/use-case-file";
import { useShipmentLines } from "#/lib/use-shipment-lines";

/* -------------------------------------------------------------------------------------------------
 * Per-shipment detail page — fully usable WHILE the pipeline is processing:
 * documents appear as they extract, lines as they classify, and the agent
 * trace streams in live over the websocket. Once processing settles it
 * reads as the shipment's standing record.
 * -----------------------------------------------------------------------------------------------*/

type Section = "documents" | "trace";

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

/** One document tile — first-page preview on a soft mat, hover to view.
 * Same preview treatment as the review workspace's document pane. */
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
          <FileText className="text-muted size-8" />
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
              <ArrowUpRightFromSquare className="size-3.5" />
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

  const { data: shipmentResponse } = useShipmentsControllerFindOne(shipmentId);
  const { data: documentsResponse } =
    useShipmentDocumentsControllerList(shipmentId);
  const caseFile = useCaseFile(shipmentId);

  const shipment = shipmentResponse?.data;
  const documents = documentsResponse?.data.documents;
  const processing = shipment?.processingState ?? null;

  // The lines endpoint is the single source of per-line truth; the hook
  // layers on the live run map from the shipment's socket room.
  const {
    lines,
    isLoaded: linesLoaded,
    runIdForLine,
    activityByLine,
    runningLineNumber,
  } = useShipmentLines(shipmentId, processing !== null);

  // Drill-down drawer — read-only outside the review flow.
  const [openLine, setOpenLine] = useState<ReviewLineItem | null>(null);
  // Full-document viewer (real PDF + the AI's reading).
  const [viewerDocument, setViewerDocument] = useState<
    (ReviewDocument & { kind: "pdf"; src?: string }) | null
  >(null);

  const [section, setSection] = useState<Section>("documents");

  // Follow the classification as it moves through the lines — unless the
  // broker picked a tab themselves. (The route keys this component by
  // shipmentId, so all of this state resets per shipment.)
  const [manualTraceLine, setManualTraceLine] = useState<number | null>(null);
  const activeTraceLine =
    manualTraceLine ??
    runningLineNumber ??
    lines.find((line) => runIdForLine[line.lineNumber])?.lineNumber ??
    lines[0]?.lineNumber;

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-4">
      {/* Header — identity + pipeline progress left, live state far right */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Button
            isIconOnly
            aria-label="Back to pipeline"
            size="sm"
            variant="ghost"
            onPress={() => navigate({ to: "/dashboard/pipeline" })}
          >
            <ArrowLeft className="size-4" />
          </Button>
          {shipment ? (
            <>
              <Avatar size="md">
                <Avatar.Image
                  src={
                    shipment.client?.image ??
                    clientLogos[shipment.client?.name ?? ""]
                  }
                />
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
          <Chip color="accent" size="md" variant="soft">
            <Chip.Label className="inline-flex items-center gap-2">
              <Spinner size="sm" />
              <TextShimmer className="text-xs">{processing}</TextShimmer>
            </Chip.Label>
          </Chip>
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
        ) : null}
      </div>

      {/* Review CTA — classification flagged lines for the broker */}
      {shipment?.status === "needs_review" ? (
        <div className="border-warning/40 bg-warning/5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <span className="inline-flex items-center gap-2">
            <ShieldExclamation className="text-warning size-4" />
            <span className="text-foreground text-sm">
              Classification needs broker review.
            </span>
          </span>
          <Button
            size="sm"
            variant="primary"
            onPress={() =>
              navigate({
                params: { itemId: shipmentId },
                to: "/dashboard/review/$itemId",
              })
            }
          >
            Open in review queue
          </Button>
        </div>
      ) : null}

      {/* Failure surface — ingest/classification failures land on the timeline */}
      {caseFile.activityEvents.some((event) =>
        /processing failed|classification failed/i.test(event.title),
      ) ? (
        <div className="border-danger/40 bg-danger/5 flex items-center gap-2 rounded-xl border p-3">
          <CircleExclamation className="text-danger size-4" />
          <span className="text-foreground text-sm">
            Processing hit a failure — see the activity timeline for details.
          </span>
        </div>
      ) : null}

      {/* Main content left, the shipment's running record on the right */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Line classifications — THE summary, always visible above the tabs */}
          {!linesLoaded ? (
            <Widget>
              <Widget.Header>
                <Widget.Title>Line classifications</Widget.Title>
              </Widget.Header>
              <Widget.Content className="flex flex-col gap-2">
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
              </Widget.Content>
            </Widget>
          ) : lines.length > 0 ? (
            <LineClassificationsCard
              activityByLine={activityByLine}
              lines={lines}
              onOpenLine={setOpenLine}
            />
          ) : (
            <Widget>
              <Widget.Header>
                <Widget.Title>Line classifications</Widget.Title>
              </Widget.Header>
              <Widget.Content>
                <span className="text-muted text-sm">
                  {processing
                    ? "Entry lines appear once the commercial invoice is read…"
                    : "No entry lines on file."}
                </span>
              </Widget.Content>
            </Widget>
          )}

          {/* Everything else lives in tabs — no endless scroll */}
          <Tabs
            selectedKey={section}
            onSelectionChange={(key) => setSection(String(key) as Section)}
          >
            <Tabs.ListContainer>
              <Tabs.List
                aria-label="Shipment record sections"
                className="w-fit"
              >
                <Tabs.Tab className="w-fit" id="documents">
                  <FileText className="mr-1.5 size-3.5" />
                  Documents{documents?.length ? ` (${documents.length})` : ""}
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab className="w-fit" id="trace">
                  <Sparkles className="mr-1.5 size-3.5" />
                  Agent trace
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            {/* Documents — preview-image tiles, three across; click opens the
            full viewer (real PDF + the AI's complete reading) */}
            <Tabs.Panel className="pt-3" id="documents">
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
            </Tabs.Panel>

            {/* Agent trace — live while classification runs */}
            <Tabs.Panel className="flex flex-col gap-3 pt-3" id="trace">
              {!linesLoaded ? (
                <Skeleton className="h-24 rounded-lg" />
              ) : lines.length === 0 ? (
                <span className="text-muted text-sm">
                  {processing
                    ? "The agent starts once the entry lines are extracted…"
                    : "No classification runs on file."}
                </span>
              ) : (
                <LineTraceTabs
                  activeLineNumber={activeTraceLine}
                  isProcessing={processing !== null}
                  lines={lines}
                  runIdForLine={runIdForLine}
                  onSelect={setManualTraceLine}
                />
              )}
            </Tabs.Panel>
          </Tabs>
        </div>

        {/* Activity — the shipment's running record, always in view. The
            sticky offset clears the 4rem sticky navbar plus a breath. */}
        <Widget className="min-w-0 xl:sticky xl:top-20">
          <Widget.Header>
            <Widget.Title>Activity</Widget.Title>
          </Widget.Header>
          <Widget.Content>
            {caseFile.isPending ? (
              <ActivitySkeleton />
            ) : caseFile.activityEvents.length === 0 ? (
              <span className="text-muted text-sm">
                {processing
                  ? "The record starts as soon as extraction lands…"
                  : "No activity recorded yet."}
              </span>
            ) : (
              <Timeline>
                {[...caseFile.activityEvents].reverse().map((event, index) => (
                  <EventTimelineItem
                    // biome-ignore lint/suspicious/noArrayIndexKey: events have no stable id in this projection
                    key={index}
                    event={event}
                  />
                ))}
              </Timeline>
            )}
          </Widget.Content>
        </Widget>
      </div>

      {/* Per-line drill-down — read-only here; corrections live in review */}
      <LineDetailDrawer
        line={openLine}
        memo={
          openLine
            ? (findLineMemo(caseFile.documents, openLine.lineNumber) ?? null)
            : null
        }
        shipmentId={shipmentId}
        onOpenChange={(open) => {
          if (!open) setOpenLine(null);
        }}
      />

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
