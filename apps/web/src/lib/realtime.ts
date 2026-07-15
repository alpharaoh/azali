import { useEffect, useRef, useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { env } from "#/env";

/**
 * The realtime channel: one lazy socket.io connection to the API's
 * /realtime namespace, authenticated by the same session cookie the REST
 * client sends. The server puts every connection in its organization's
 * room; viewing a shipment additionally joins that shipment's room for the
 * granular stream (timeline events, document/line updates, live agent
 * trace). Mirrors services/api/src/realtime/bus.ts.
 */
export interface WireShipmentEvent {
  id: string;
  type: string;
  actor: string;
  title: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface WireRunItem {
  id: string;
  stepIndex: number;
  itemIndex: number;
  kind: string;
  toolName: string | null;
  toolCallId: string | null;
  content: Record<string, unknown>;
}

export interface RealtimeEvents {
  "shipment.changed": { shipmentId: string };
  "shipment.event": { shipmentId: string; event: WireShipmentEvent };
  "document.changed": {
    shipmentId: string;
    document: {
      id: string;
      name: string;
      status: string;
      failureReason?: string | null;
    };
  };
  "line.changed": {
    shipmentId: string;
    line: {
      id: string;
      lineNumber: number;
      status: string;
      htsCode: string | null;
      confidence: number | null;
    };
  };
  "run.started": {
    shipmentId: string;
    runId: string;
    lineNumber: number | null;
  };
  "run.item": { shipmentId: string; runId: string; item: WireRunItem };
  "run.finished": {
    shipmentId: string;
    runId: string;
    status: "completed" | "failed";
  };
}

let socket: Socket | null = null;
/** shipmentId → mounted subscribers + their join callbacks (rooms are
 * ref-counted so overlapping pages — e.g. review + detail during a
 * navigation — never tear each other's subscription down). */
const subscribed = new Map<
  string,
  { count: number; joined: Set<() => void> }
>();

/** Ask the server to join the room; the ack fires once membership is
 * CONFIRMED, so callers can refetch anything emitted before the join. */
function emitSubscribe(s: Socket, shipmentId: string) {
  s.emit("shipment.subscribe", { shipmentId }, () => {
    const entry = subscribed.get(shipmentId);
    if (!entry) return;
    for (const onJoined of entry.joined) onJoined();
  });
}

export function getRealtimeSocket(): Socket {
  if (!socket) {
    socket = io(`${env.API_SERVER_URL}/realtime`, {
      withCredentials: true,
      // websocket-first: the polling fallback needs LB sticky sessions.
      transports: ["websocket", "polling"],
    });
    socket.on("connect", () => {
      // Re-join every tracked room after any (re)connect.
      const s = socket;
      if (!s) return;
      for (const shipmentId of subscribed.keys()) {
        emitSubscribe(s, shipmentId);
      }
    });
  }
  return socket;
}

/** Reactive connection state — poll fallbacks key off this. */
export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const s = getRealtimeSocket();
      s.on("connect", notify);
      s.on("disconnect", notify);
      return () => {
        s.off("connect", notify);
        s.off("disconnect", notify);
      };
    },
    () => getRealtimeSocket().connected,
  );
}

/** Listen to one server event. The handler lives in a ref, so a fresh
 * closure per render never re-subscribes the socket listener. */
export function useRealtimeEvent<K extends keyof RealtimeEvents>(
  event: K,
  handler: (payload: RealtimeEvents[K]) => void,
) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getRealtimeSocket();
    const listener = (payload: RealtimeEvents[K]) => ref.current(payload);
    s.on(event as string, listener);
    return () => {
      s.off(event as string, listener);
    };
  }, [event]);
}

/** Fires on every RE-connect (not the first connect) — used to heal any
 * updates missed while the socket was down. */
export function useRealtimeReconnect(handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getRealtimeSocket();
    const onReconnect = () => ref.current();
    s.io.on("reconnect", onReconnect);
    return () => {
      s.io.off("reconnect", onReconnect);
    };
  }, []);
}

/**
 * Join a shipment's room for the lifetime of the calling component.
 *
 * `onJoined` fires every time room membership is confirmed (first join and
 * every rejoin after a reconnect). The page's queries fetch BEFORE the join
 * completes, so anything the pipeline emitted in that window never reached
 * this client — the callback is where callers refetch to close the gap.
 */
export function useShipmentChannel(
  shipmentId: string | undefined,
  onJoined?: () => void,
) {
  const joinedRef = useRef(onJoined);
  joinedRef.current = onJoined;

  useEffect(() => {
    if (!shipmentId) return;
    const s = getRealtimeSocket();
    const onJoinedStable = () => joinedRef.current?.();
    const entry = subscribed.get(shipmentId) ?? {
      count: 0,
      joined: new Set<() => void>(),
    };
    entry.count += 1;
    entry.joined.add(onJoinedStable);
    subscribed.set(shipmentId, entry);
    if (entry.count === 1 && s.connected) {
      emitSubscribe(s, shipmentId);
    }
    return () => {
      const current = subscribed.get(shipmentId);
      if (!current) return;
      current.count -= 1;
      current.joined.delete(onJoinedStable);
      if (current.count <= 0) {
        subscribed.delete(shipmentId);
        if (s.connected) s.emit("shipment.unsubscribe", { shipmentId });
      }
    };
  }, [shipmentId]);
}
