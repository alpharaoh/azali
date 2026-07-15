import type {
  SelectAgentRunItem,
  SelectShipmentDocument,
  SelectShipmentEvent,
  SelectShipmentLineItem,
} from "@/db/schema";
import { realtimeBus } from "./bus";

/** Live-stream frames are clamped harder than the DB row — the client
 * refetches the authoritative record when the run finishes. */
const MAX_WIRE_BYTES = 8_192;

function clampForWire(content: Record<string, unknown>) {
  const serialized = JSON.stringify(content);
  if (serialized && serialized.length > MAX_WIRE_BYTES) {
    return { preview: serialized.slice(0, MAX_WIRE_BYTES), truncated: true };
  }
  return content;
}

/**
 * The ONLY place database rows become realtime wire payloads. Query helpers
 * call these one-liners after their write commits; the gateway routes the
 * result to browser rooms. Every wire shape here mirrors its declaration in
 * bus.ts — change them together.
 */

export function publishShipmentChanged(row: {
  id: string;
  organizationId: string;
}) {
  realtimeBus.emit("shipment.changed", {
    organizationId: row.organizationId,
    shipmentId: row.id,
  });
}

export function publishShipmentEvent(row: SelectShipmentEvent) {
  realtimeBus.emit("shipment.event", {
    organizationId: row.organizationId,
    shipmentId: row.shipmentId,
    event: {
      id: row.id,
      type: row.type,
      actor: row.actor,
      title: row.title,
      occurredAt: row.occurredAt.toISOString(),
      payload: row.payload,
    },
  });
}

export function publishDocumentChanged(
  row: SelectShipmentDocument & { shipmentId: string },
) {
  realtimeBus.emit("document.changed", {
    organizationId: row.organizationId,
    shipmentId: row.shipmentId,
    document: {
      id: row.id,
      name: row.fileName,
      status: row.status,
      failureReason: row.failureReason,
    },
  });
}

export function publishLineChanged(row: SelectShipmentLineItem) {
  realtimeBus.emit("line.changed", {
    organizationId: row.organizationId,
    shipmentId: row.shipmentId,
    line: {
      id: row.id,
      lineNumber: row.lineNumber,
      status: row.status,
      htsCode: row.htsCode,
      confidence: row.confidence,
    },
  });
}

export function publishRunStarted(payload: {
  organizationId: string;
  shipmentId: string;
  runId: string;
  lineNumber: number | null;
}) {
  realtimeBus.emit("run.started", payload);
}

export function publishRunItem(routing: {
  organizationId: string;
  shipmentId: string;
  runId: string;
  item: SelectAgentRunItem;
}) {
  realtimeBus.emit("run.item", {
    organizationId: routing.organizationId,
    shipmentId: routing.shipmentId,
    runId: routing.runId,
    item: {
      id: routing.item.id,
      stepIndex: routing.item.stepIndex,
      itemIndex: routing.item.itemIndex,
      kind: routing.item.kind,
      toolName: routing.item.toolName,
      toolCallId: routing.item.toolCallId,
      content: clampForWire(routing.item.content),
    },
  });
}

export function publishRunFinished(payload: {
  organizationId: string;
  shipmentId: string;
  runId: string;
  status: "completed" | "failed";
}) {
  realtimeBus.emit("run.finished", payload);
}
