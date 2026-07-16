import { useMemo } from "react";
import type { LineActivity } from "#/components/case-file/line-classifications-card";
import {
  useAgentRunsControllerList,
  useShipmentsControllerLines,
} from "#/generated/api";
import type { ReviewLineAlternate, ReviewLineItem } from "#/lib/review-types";
import { useShipmentRealtime } from "#/lib/use-realtime-cache";

export type RunStatus = "running" | "completed" | "failed";

/**
 * A shipment's entry lines, live. Everything renders from two durable
 * queries — the lines endpoint (the row carries the full classification
 * snapshot: code, confidence, duty, alternates, summary, runId) and the
 * runs list (which run works which line, and whether it is still running).
 * The socket room only refreshes those queries, so the picture is identical
 * whether you watched the run live, opened the page mid-run, or refreshed.
 */
export function useShipmentLines(shipmentId: string, isProcessing: boolean) {
  // Joins the shipment's socket room and wires its stream into the caches
  // the queries below read from.
  useShipmentRealtime(shipmentId);
  const { data: linesResponse } = useShipmentsControllerLines(shipmentId);
  const { data: runsResponse } = useAgentRunsControllerList(shipmentId);

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
        runId: line.runId,
        summary: line.summary,
        ...(line.duty ? { duty: line.duty } : {}),
        ...(line.alternates
          ? { alternates: line.alternates as unknown as ReviewLineAlternate[] }
          : {}),
      })),
    [linesResponse],
  );

  // Which run works which line, and each run's status — straight from the
  // runs list (newest first, so the first hit per line is the current run).
  const { runsByLine, runStatuses } = useMemo(() => {
    const byLine: Record<number, string> = {};
    const statuses: Record<string, RunStatus> = {};
    for (const run of runsResponse?.data.runs ?? []) {
      statuses[run.id] = run.status as RunStatus;
      if (
        run.agent === "classification" &&
        run.lineNumber !== null &&
        byLine[run.lineNumber] === undefined
      ) {
        byLine[run.lineNumber] = run.id;
      }
    }
    return { runsByLine: byLine, runStatuses: statuses };
  }, [runsResponse]);

  // The audit run behind each line: the row's runId once classification
  // lands, overlaid by the in-flight run while one is working.
  const runIdForLine = useMemo(() => {
    const map: Record<number, string> = {};
    for (const line of lines) {
      if (line.runId) map[line.lineNumber] = line.runId;
    }
    return { ...runsByLine, ...map };
  }, [lines, runsByLine]);

  // What each unclassified line is doing right now.
  const activityByLine = useMemo(() => {
    const map: Record<number, LineActivity> = {};
    if (!isProcessing) return map;
    for (const line of lines) {
      if (line.htsCode) continue;
      const runId = runsByLine[line.lineNumber];
      map[line.lineNumber] =
        runId && runStatuses[runId] === "running" ? "classifying" : "queued";
    }
    return map;
  }, [lines, isProcessing, runsByLine, runStatuses]);

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
