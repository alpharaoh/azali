import {
  ArrowLeft,
  CircleExclamation,
  FileText,
  ListUl,
  ShieldExclamation,
  Sparkles,
} from "@gravity-ui/icons";
import { Avatar, Button, Chip, Skeleton, Spinner, Tabs } from "@heroui/react";
import { TextShimmer, Timeline, Widget } from "@heroui-pro/react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AgentRunTrace } from "#/components/agent-run-trace";
import {
  StageTracker,
  statusFromApi,
  statusMeta,
} from "#/components/pipeline-board";
import {
  type LineActivity,
  LineClassificationsCard,
} from "#/components/review/line-classifications-card";
import {
  ActivitySkeleton,
  EventTimelineItem,
} from "#/components/review/timeline-items";
import { clientLogos } from "#/data/client-logos";
import type { ListShipmentDocumentsResponseDtoDocumentsItem } from "#/generated/api";
import {
  useShipmentDocumentsControllerList,
  useShipmentsControllerFindOne,
  useShipmentsControllerLines,
} from "#/generated/api";
import type { ReviewLineItem } from "#/lib/review-types";
import { useCaseFile } from "#/lib/use-case-file";
import { useShipmentRealtime } from "#/lib/use-realtime-cache";

/* -------------------------------------------------------------------------------------------------
 * Per-shipment detail page — fully usable WHILE the pipeline is processing:
 * documents appear as they extract, lines as they classify, and the agent
 * trace streams in live over the websocket. Once processing settles it
 * reads as the shipment's standing record.
 * -----------------------------------------------------------------------------------------------*/

type Section = "documents" | "trace" | "activity";

function DocumentCard({
  document,
}: {
  document: ListShipmentDocumentsResponseDtoDocumentsItem;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="text-muted size-4 shrink-0" />
          <div className="flex min-w-0 flex-col">
            <span className="text-foreground truncate text-sm font-medium">
              {document.fileName}
            </span>
            <span className="text-muted text-xs">
              {document.category.replace(/_/g, " ")}
              {document.pageCount
                ? ` · ${document.pageCount} page${document.pageCount === 1 ? "" : "s"}`
                : ""}
            </span>
          </div>
        </div>
        {document.status === "pending" ? (
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <Spinner size="sm" />
            <TextShimmer className="text-xs">Reading…</TextShimmer>
          </span>
        ) : document.status === "failed" ? (
          <Chip color="danger" size="sm" variant="soft">
            <Chip.Label>Extraction failed</Chip.Label>
          </Chip>
        ) : (
          <Chip color="success" size="sm" variant="soft">
            <Chip.Label>Extracted</Chip.Label>
          </Chip>
        )}
      </div>
      {document.status === "extracted" && document.extraction ? (
        <div className="flex min-w-0 gap-3">
          {document.previewUrl ? (
            <img
              alt={`${document.fileName} preview`}
              className="h-20 w-auto shrink-0 rounded-md border object-cover object-top"
              src={document.previewUrl}
            />
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            {document.extraction.summary ? (
              <p className="text-muted m-0 line-clamp-2 text-xs leading-relaxed">
                {document.extraction.summary}
              </p>
            ) : null}
            <div className="flex min-w-0 flex-col gap-0.5 font-mono text-xs">
              {(document.extraction.fields ?? [])
                .slice(0, 2)
                .map((field: { label: string; value: string }) => (
                  <span key={field.label} className="text-muted truncate">
                    {field.label}: {field.value}
                  </span>
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ShipmentDetail({ shipmentId }: { shipmentId: string }) {
  const navigate = useNavigate();
  // Joins the shipment's socket room and streams updates into the caches
  // the queries below read from.
  const { runsByLine, runStatuses } = useShipmentRealtime(shipmentId);

  const { data: shipmentResponse } = useShipmentsControllerFindOne(shipmentId);
  const { data: linesResponse } = useShipmentsControllerLines(shipmentId);
  const { data: documentsResponse } =
    useShipmentDocumentsControllerList(shipmentId);
  const caseFile = useCaseFile(shipmentId);

  const shipment = shipmentResponse?.data;
  const documents = documentsResponse?.data.documents;
  const processing = shipment?.processingState ?? null;

  // The lines endpoint is the durable source; the card renders its slim
  // review shape.
  const lines: ReviewLineItem[] = useMemo(
    () =>
      (linesResponse?.data.lines ?? []).map((line) => ({
        lineItemId: line.id,
        lineNumber: line.lineNumber,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        valueUsd: line.totalValueUsd,
        htsCode: line.htsCode,
        confidence: line.confidence,
        status: line.status,
        reused: line.reusedFromProduct,
      })),
    [linesResponse],
  );

  // What each unclassified line is doing right now.
  const activityByLine: Record<number, LineActivity> = useMemo(() => {
    const map: Record<number, LineActivity> = {};
    if (!processing) return map;
    for (const line of lines) {
      if (line.htsCode) continue;
      const runId = runsByLine[line.lineNumber];
      map[line.lineNumber] =
        runId && runStatuses[runId] === "running" ? "classifying" : "queued";
    }
    return map;
  }, [lines, processing, runsByLine, runStatuses]);

  // runId per line: live run.started events first, then agent_trace events
  // (covers a mid-run reload), oldest last so the latest run wins.
  const runIdForLine = useMemo(() => {
    const map: Record<number, string> = {};
    for (const entry of caseFile.traceRuns) {
      if (entry.lineNumber !== undefined) map[entry.lineNumber] = entry.runId;
    }
    return { ...map, ...runsByLine };
  }, [caseFile.traceRuns, runsByLine]);

  const tracedLines = lines.filter(
    (line) => runIdForLine[line.lineNumber] || !line.reused,
  );

  const [section, setSection] = useState<Section>("documents");

  // Follow the classification as it moves through the lines — unless the
  // broker picked a tab themselves.
  const [manualTraceLine, setManualTraceLine] = useState<number | null>(null);
  const runningLine = Object.entries(runsByLine).find(
    ([, runId]) => runStatuses[runId] === "running",
  )?.[0];
  const activeTraceLine =
    manualTraceLine ??
    (runningLine !== undefined ? Number(runningLine) : undefined) ??
    tracedLines.find((line) => runIdForLine[line.lineNumber])?.lineNumber ??
    tracedLines[0]?.lineNumber;
  // Reset manual selection when navigating to another shipment.
  useEffect(() => setManualTraceLine(null), []);

  const activeRunId =
    activeTraceLine !== undefined ? runIdForLine[activeTraceLine] : undefined;
  const activeLine = lines.find((line) => line.lineNumber === activeTraceLine);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {/* Header — identity left, live state right */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
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
        <div className="flex items-center gap-4">
          {shipment ? (
            <StageTracker
              stage={shipment.stage}
              status={statusFromApi[shipment.status]}
            />
          ) : null}
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
            Processing hit a failure — see the Activity tab for details.
          </span>
        </div>
      ) : null}

      {/* Line classifications — THE summary, always visible above the tabs */}
      {linesResponse === undefined ? (
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
          <Tabs.List aria-label="Shipment record sections" className="w-fit">
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
            <Tabs.Tab className="w-fit" id="activity">
              <ListUl className="mr-1.5 size-3.5" />
              Activity
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        {/* Documents — compact two-up grid, no vertical sprawl */}
        <Tabs.Panel className="pt-3" id="documents">
          {documents === undefined ? (
            <div className="grid gap-2 lg:grid-cols-2">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          ) : documents.length === 0 ? (
            <span className="text-muted text-sm">
              {processing
                ? "Registering uploaded documents…"
                : "No documents on file."}
            </span>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {documents.map((document) => (
                <DocumentCard key={document.id} document={document} />
              ))}
            </div>
          )}
        </Tabs.Panel>

        {/* Agent trace — live while classification runs */}
        <Tabs.Panel className="flex flex-col gap-3 pt-3" id="trace">
          {linesResponse === undefined ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : lines.length === 0 ? (
            <span className="text-muted text-sm">
              {processing
                ? "The agent starts once the entry lines are extracted…"
                : "No classification runs on file."}
            </span>
          ) : (
            <>
              {lines.length > 1 ? (
                <Tabs
                  selectedKey={String(activeTraceLine ?? "")}
                  variant="secondary"
                  onSelectionChange={(key) => setManualTraceLine(Number(key))}
                >
                  <Tabs.ListContainer>
                    <Tabs.List aria-label="Line item traces" className="w-fit">
                      {lines.map((line) => (
                        <Tabs.Tab
                          key={line.lineNumber}
                          className="w-fit max-w-56 shrink-0"
                          id={String(line.lineNumber)}
                        >
                          <Chip
                            className="mr-1.5 shrink-0"
                            size="sm"
                            variant="soft"
                          >
                            <Chip.Label className="tabular-nums">
                              {line.lineNumber}
                            </Chip.Label>
                          </Chip>
                          <span className="min-w-0 truncate whitespace-nowrap">
                            {line.description}
                          </span>
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      ))}
                    </Tabs.List>
                  </Tabs.ListContainer>
                </Tabs>
              ) : null}
              {activeRunId ? (
                <AgentRunTrace key={activeRunId} runId={activeRunId} />
              ) : activeLine?.reused ? (
                <span className="text-muted text-sm">
                  Reused from product memory — this line's classification came
                  from an earlier broker-verified decision, so there is no fresh
                  audit run.
                </span>
              ) : processing ? (
                <span className="inline-flex items-center gap-2 py-1">
                  <Sparkles className="text-muted size-4" />
                  <TextShimmer className="text-sm">
                    The agent will start on this line shortly…
                  </TextShimmer>
                </span>
              ) : (
                <span className="text-muted text-sm">
                  No audit run recorded for this line.
                </span>
              )}
            </>
          )}
        </Tabs.Panel>

        {/* Activity — the shipment's timeline */}
        <Tabs.Panel className="pt-3" id="activity">
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
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
