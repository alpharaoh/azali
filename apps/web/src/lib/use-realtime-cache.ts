import { useQueryClient } from "@tanstack/react-query";
import { throttle } from "lodash-es";
import { useMemo } from "react";
import type {
  agentRunsControllerFindResponse,
  ListShipmentEventsResponseDtoDataItem,
  shipmentEventsControllerFindByShipmentResponse,
} from "#/generated/api";
import {
  getAgentRunsControllerFindQueryKey,
  getAgentRunsControllerListQueryKey,
  getShipmentDocumentsControllerListQueryKey,
  getShipmentEventsControllerFindByShipmentQueryKey,
  getShipmentsControllerLinesQueryKey,
} from "#/generated/api";
import {
  useRealtimeEvent,
  useRealtimeReconnect,
  useShipmentChannel,
} from "#/lib/realtime";

/**
 * Org-wide realtime wiring — mount ONCE in the dashboard layout. Any
 * shipment row change refreshes the mounted list views (pipeline, review
 * queue, stats), throttled so processing bursts don't refetch-storm.
 */
export function useRealtimeDashboard() {
  const queryClient = useQueryClient();

  const invalidateLists = useMemo(
    () =>
      throttle(() => {
        // Partial keys: ["/v1/shipments"] matches every list-params variant
        // but NOT ["/v1/shipments/<id>"] (different first segment string).
        void queryClient.invalidateQueries({ queryKey: ["/v1/shipments"] });
        void queryClient.invalidateQueries({
          queryKey: ["/v1/shipments/stats"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["/v1/shipments/events"],
        });
      }, 500),
    [queryClient],
  );

  useRealtimeEvent("shipment.changed", invalidateLists);

  // Heal the list views after an outage. Per-shipment surfaces heal
  // themselves — every rejoin's ack triggers the refetch in
  // useShipmentRealtime below.
  useRealtimeReconnect(() => {
    invalidateLists();
    void queryClient.invalidateQueries({ queryKey: ["/v1/runs"] });
  });
}

type EventsResponse = shipmentEventsControllerFindByShipmentResponse;
type RunResponse = agentRunsControllerFindResponse;

/**
 * Per-shipment realtime wiring: joins the shipment's socket room and
 * translates its stream into targeted cache writes — appends where the
 * payload is complete, invalidations where the REST shape is richer.
 * Pure cache plumbing: components render from the queries, never from
 * socket payloads directly.
 */
export function useShipmentRealtime(shipmentId: string | undefined) {
  const queryClient = useQueryClient();

  // Close the fetch→join gap: the page's queries fetch BEFORE room
  // membership is confirmed (hard refresh, SPA navigation right after an
  // upload, reconnects) — anything the pipeline emitted in that window
  // never reached this client. The join ack is the moment the stream is
  // provably live, so refetch this shipment's surfaces right then.
  useShipmentChannel(shipmentId, () => {
    if (!shipmentId) return;
    void queryClient.invalidateQueries({
      queryKey: [`/v1/shipments/${shipmentId}`],
    });
    void queryClient.invalidateQueries({
      queryKey: getShipmentEventsControllerFindByShipmentQueryKey(shipmentId),
    });
    void queryClient.invalidateQueries({
      queryKey: getShipmentDocumentsControllerListQueryKey(shipmentId),
    });
    void queryClient.invalidateQueries({
      queryKey: getShipmentsControllerLinesQueryKey(shipmentId),
    });
    void queryClient.invalidateQueries({
      queryKey: getAgentRunsControllerListQueryKey(shipmentId),
    });
  });

  const invalidateDocuments = useMemo(
    () =>
      throttle(() => {
        if (!shipmentId) return;
        void queryClient.invalidateQueries({
          queryKey: getShipmentDocumentsControllerListQueryKey(shipmentId),
        });
      }, 500),
    [queryClient, shipmentId],
  );

  const invalidateLines = useMemo(
    () =>
      throttle(() => {
        if (!shipmentId) return;
        void queryClient.invalidateQueries({
          queryKey: getShipmentsControllerLinesQueryKey(shipmentId),
        });
      }, 500),
    [queryClient, shipmentId],
  );

  // Timeline events append straight into the cache — no refetch. The list
  // is occurredAt DESC; insert sorted and dedupe by id. setQueriesData
  // partial-matches the key so the { limit: 200 } variant is covered.
  useRealtimeEvent("shipment.event", ({ shipmentId: sid, event }) => {
    if (sid !== shipmentId) return;
    queryClient.setQueriesData<EventsResponse>(
      { queryKey: getShipmentEventsControllerFindByShipmentQueryKey(sid) },
      (old) => {
        // Never fabricate a cache entry — the first fetch includes the event.
        if (!old) return old;
        if (old.data.data.some((entry) => entry.id === event.id)) return old;
        const row: ListShipmentEventsResponseDtoDataItem = {
          ...event,
          shipmentId: sid,
          createdAt: event.occurredAt,
          updatedAt: null,
          deletedAt: null,
          // Not read by any consumer; present to satisfy the DTO shape.
          organizationId: "",
          userId: "",
        };
        const data = [...old.data.data];
        const at = data.findIndex(
          (entry) => entry.occurredAt <= event.occurredAt,
        );
        data.splice(at === -1 ? data.length : at, 0, row);
        return {
          ...old,
          data: { data, count: old.data.count + 1 },
        };
      },
    );
  });

  // Live agent trace: append each item into the run-detail cache, deduped
  // by (stepIndex, itemIndex) and kept sorted.
  useRealtimeEvent("run.item", ({ shipmentId: sid, runId, item }) => {
    if (sid !== shipmentId) return;
    queryClient.setQueryData<RunResponse>(
      getAgentRunsControllerFindQueryKey(runId),
      (old) => {
        // No cache yet → the mount-time fetch returns everything.
        if (!old) return old;
        if (
          old.data.items.some(
            (entry) =>
              entry.stepIndex === item.stepIndex &&
              entry.itemIndex === item.itemIndex,
          )
        ) {
          return old;
        }
        const items = [
          ...old.data.items,
          {
            stepIndex: item.stepIndex,
            itemIndex: item.itemIndex,
            kind: item.kind,
            toolName: item.toolName,
            toolCallId: item.toolCallId,
            content: item.content,
            createdAt: new Date().toISOString(),
          },
        ].sort(
          (a, b) => a.stepIndex - b.stepIndex || a.itemIndex - b.itemIndex,
        );
        return { ...old, data: { ...old.data, items } };
      },
    );
  });

  // The runs-list query is the durable source of which run works which
  // line (see useShipmentLines) — live run events just refresh it.
  useRealtimeEvent("run.started", ({ shipmentId: sid }) => {
    if (sid !== shipmentId) return;
    void queryClient.invalidateQueries({
      queryKey: getAgentRunsControllerListQueryKey(sid),
    });
  });

  // The wire stream is clamped (~8KB/item) — refetch the authoritative
  // record once the run ends, and refresh the list so statuses settle.
  useRealtimeEvent("run.finished", ({ shipmentId: sid, runId }) => {
    if (sid !== shipmentId) return;
    void queryClient.invalidateQueries({
      queryKey: getAgentRunsControllerFindQueryKey(runId),
    });
    void queryClient.invalidateQueries({
      queryKey: getAgentRunsControllerListQueryKey(sid),
    });
  });

  // The wire payload is slim and the docs list needs fresh presigned URLs
  // and extraction fields — a refetch of one small endpoint covers it all.
  useRealtimeEvent("document.changed", ({ shipmentId: sid }) => {
    if (sid !== shipmentId) return;
    invalidateDocuments();
  });

  // The wire payload is deliberately slim (id/status/code/confidence) while
  // the row carries much more (duty, alternates, summary, runId) — a
  // partial patch would silently freeze everything it omits, so refetch the
  // one small endpoint and stay authoritative. Throttled like documents.
  useRealtimeEvent("line.changed", ({ shipmentId: sid }) => {
    if (sid !== shipmentId) return;
    invalidateLines();
  });
}
