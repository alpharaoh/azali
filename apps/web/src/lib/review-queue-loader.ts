import type { QueryClient } from "@tanstack/react-query";
import {
  getClientsControllerFindAllQueryOptions,
  getShipmentEventsControllerFindAllQueryOptions,
  getShipmentsControllerFindAllQueryOptions,
} from "#/generated/api";

/** Shared by /dashboard/review and /dashboard/review/$itemId. */
export function prefetchReviewQueue(queryClient: QueryClient) {
  return Promise.all([
    queryClient.ensureQueryData(
      getShipmentsControllerFindAllQueryOptions({
        limit: 100,
        sortBy: "reviewDeadlineAt",
        sortDir: "asc",
        status: ["needs_review"],
      }),
    ),
    queryClient.prefetchQuery(
      getShipmentEventsControllerFindAllQueryOptions({
        limit: 200,
        type: ["review_requested"],
      }),
    ),
    queryClient.prefetchQuery(
      getClientsControllerFindAllQueryOptions({ limit: 100 }),
    ),
  ]);
}
