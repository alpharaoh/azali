import type { LineActivity } from "#/components/case-file/line-classifications-card";
import {
  useAgentRunsControllerList,
  useShipmentsControllerLines,
} from "#/generated/api";
import type { ReviewLineAlternate, ReviewLineItem } from "#/lib/review-types";
import { PROCESSING_POLL_MS } from "#/lib/use-case-file";

export type RunStatus = "running" | "completed" | "failed";

/**
 * A shipment's entry lines, live. Everything renders from two durable
 * queries — the lines endpoint (the row carries the full classification
 * snapshot: code, confidence, duty, alternates, summary, runId) and the
 * runs list (which run works which line, and whether it is still running).
 * While the pipeline runs, both poll on an interval (interval refetches
 * never cancel in-flight requests) — so the picture is identical whether
 * you watched the run live, opened the page mid-run, or refreshed.
 */
export function useShipmentLines(shipmentId: string, isProcessing: boolean) {
  const poll = isProcessing ? PROCESSING_POLL_MS : false;
  const { data: linesResponse } = useShipmentsControllerLines(shipmentId, {
    query: { refetchInterval: poll },
  });
  const { data: runsResponse } = useAgentRunsControllerList(shipmentId, {
    query: { refetchInterval: poll },
  });

  const lines: ReviewLineItem[] = (linesResponse?.data.lines ?? []).map(
    (line) => ({
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
      runId: line.runId,
      summary: line.summary,
      ...(line.duty ? { duty: line.duty } : {}),
      ...(line.alternates
        ? { alternates: line.alternates as unknown as ReviewLineAlternate[] }
        : {}),
    }),
  );

  // Which run works which line, and each run's status — straight from the
  // runs list (newest first, so the first hit per line is the current run).
  const runsByLine: Record<number, string> = {};
  const runStatuses: Record<string, RunStatus> = {};
  for (const run of runsResponse?.data.runs ?? []) {
    runStatuses[run.id] = run.status as RunStatus;
    if (
      run.agent === "classification" &&
      run.lineNumber !== null &&
      runsByLine[run.lineNumber] === undefined
    ) {
      runsByLine[run.lineNumber] = run.id;
    }
  }

  // The audit run behind each line: the row's runId once classification
  // lands, overlaid by the in-flight run while one is working.
  const lineRunIds: Record<number, string> = {};
  for (const line of lines) {
    if (line.runId) lineRunIds[line.lineNumber] = line.runId;
  }
  const runIdForLine = { ...runsByLine, ...lineRunIds };

  // What each unclassified line is doing right now.
  const activityByLine: Record<number, LineActivity> = {};
  if (isProcessing) {
    for (const line of lines) {
      if (line.htsCode) continue;
      const runId = runsByLine[line.lineNumber];
      activityByLine[line.lineNumber] =
        runId && runStatuses[runId] === "running" ? "classifying" : "queued";
    }
  }

  // The line a run is actively working, when one is.
  const runningEntry = Object.entries(runsByLine).find(
    ([, runId]) => runStatuses[runId] === "running",
  );

  return {
    lines,
    /** False until the first fetch lands — render skeletons. */
    isLoaded: linesResponse !== undefined,
    runIdForLine,
    runStatuses,
    activityByLine,
    runningLineNumber: runningEntry ? Number(runningEntry[0]) : undefined,
  };
}
