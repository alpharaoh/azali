import { EventEmitter } from "node:events";

/**
 * The in-process realtime bus: DB write helpers and the agent recorder emit
 * here; the socket gateway fans events out to browser rooms.
 *
 * Payloads carry `organizationId` for ROOM ROUTING only — the gateway strips
 * it before anything reaches the wire.
 *
 * This is a module-level singleton (not a Nest provider) because the Inngest
 * functions, query helpers, and the agent recorder all live outside Nest DI.
 * It is intentionally dependency-free so anything can import it without
 * cycles. Emits are in-process only; cross-instance delivery of the browser
 * broadcasts is handled by the socket.io Redis adapter (see main.ts) — and
 * because Inngest functions always execute inside an API instance, every
 * emit reaches a local gateway.
 */
export interface RealtimeEvents {
  /** A shipments row was inserted/updated/deleted — org-wide list refresh. */
  "shipment.changed": { organizationId: string; shipmentId: string };
  /** A timeline event was appended to a shipment. */
  "shipment.event": {
    organizationId: string;
    shipmentId: string;
    event: {
      id: string;
      type: string;
      actor: string;
      title: string;
      occurredAt: string;
      payload: Record<string, unknown>;
    };
  };
  /** A shipment document changed (extraction status, preview, …). */
  "document.changed": {
    organizationId: string;
    shipmentId: string;
    document: {
      id: string;
      name: string;
      status: string;
      failureReason?: string | null;
    };
  };
  /** A shipment line item was inserted or updated. */
  "line.changed": {
    organizationId: string;
    shipmentId: string;
    line: {
      id: string;
      lineNumber: number;
      status: string;
      htsCode: string | null;
      confidence: number | null;
    };
  };
  /** An agent run began for one of the shipment's lines. */
  "run.started": {
    organizationId: string;
    shipmentId: string;
    runId: string;
    lineNumber: number | null;
  };
  /** One persisted trace item (thought / tool call / tool result). */
  "run.item": {
    organizationId: string;
    shipmentId: string;
    runId: string;
    item: {
      id: string;
      stepIndex: number;
      itemIndex: number;
      kind: string;
      toolName: string | null;
      toolCallId: string | null;
      content: Record<string, unknown>;
    };
  };
  /** The run ended — clients refetch the authoritative record. */
  "run.finished": {
    organizationId: string;
    shipmentId: string;
    runId: string;
    status: "completed" | "failed";
  };
}

class RealtimeBus {
  private readonly emitter = new EventEmitter().setMaxListeners(50);

  /** Never throws — a realtime hiccup must not break the write it rode on. */
  emit<K extends keyof RealtimeEvents>(name: K, payload: RealtimeEvents[K]) {
    try {
      this.emitter.emit(name, payload);
    } catch {
      // Listeners own their errors; the write path stays untouched.
    }
  }

  on<K extends keyof RealtimeEvents>(
    name: K,
    listener: (payload: RealtimeEvents[K]) => void,
  ) {
    this.emitter.on(name, listener);
    return () => this.emitter.off(name, listener);
  }
}

export const realtimeBus = new RealtimeBus();
