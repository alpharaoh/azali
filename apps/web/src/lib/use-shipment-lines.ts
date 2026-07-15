import { useMemo } from "react";
import type { LineActivity } from "#/components/case-file/line-classifications-card";
import { useShipmentsControllerLines } from "#/generated/api";
import type { ReviewLineAlternate, ReviewLineItem } from "#/lib/review-types";
import { useShipmentRealtime } from "#/lib/use-realtime-cache";

/**
 * A shipment's entry lines, live. The lines endpoint is the single source
 * of per-line truth (the row carries the full classification snapshot:
 * code, confidence, duty, alternates, summary, runId); the shipment's
 * socket room layers on what is happening RIGHT NOW — which line a run is
 * working, so the UI can point at it before the row lands.
 */
export function useShipmentLines(shipmentId: string, isProcessing: boolean) {
  // Joins the shipment's socket room and wires its stream into the caches
  // the queries below read from.
  const { runsByLine, runStatuses } = useShipmentRealtime(shipmentId);
  const { data: linesResponse } = useShipmentsControllerLines(shipmentId);

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

  // The audit run behind each line: the row's runId once classification
  // lands, overlaid by live run.started events while a run is in flight.
  const runIdForLine = useMemo(() => {
    const map: Record<number, string> = {};
    for (const line of lines) {
      if (line.runId) map[line.lineNumber] = line.runId;
    }
    return { ...map, ...runsByLine };
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
