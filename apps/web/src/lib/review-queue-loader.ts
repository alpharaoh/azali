import type { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type { ShipmentsControllerFindAllParams } from "#/generated/api";
import {
  getShipmentEventsControllerFindAllQueryOptions,
  getShipmentsControllerFindAllQueryOptions,
  getShipmentsControllerStatsQueryOptions,
} from "#/generated/api";

export const REVIEW_FILTER_GROUPS = [
  { id: "all", label: "All", types: null },
  { id: "classification", label: "Classification", types: ["classification"] },
  { id: "signoff", label: "Sign-off", types: ["signoff"] },
  { id: "document", label: "Documents", types: ["document"] },
  {
    id: "compliance",
    label: "Compliance",
    types: ["enforcement", "pga", "valuation"],
  },
] as const;

export type ReviewFilterId = (typeof REVIEW_FILTER_GROUPS)[number]["id"];

export const reviewSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  type: z
    .enum(REVIEW_FILTER_GROUPS.map((group) => group.id))
    .optional()
    .catch(undefined),
});

export type ReviewSearch = z.infer<typeof reviewSearchSchema>;

/** Server-side list params for the pending queue, derived from the URL. */
export function reviewListParams(
  search: ReviewSearch,
): ShipmentsControllerFindAllParams {
  const group = REVIEW_FILTER_GROUPS.find(
    (entry) => entry.id === (search.type ?? "all"),
  );

  return {
    limit: 100,
    reviewType: group?.types ? [...group.types] : undefined,
    search: search.q,
    sortBy: "reviewDeadlineAt",
    sortDir: "asc",
    status: ["needs_review"],
  };
}

/**
 * Shared by /dashboard/review and /dashboard/review/$itemId.
 * Fire-and-forget cache warming — never blocks navigation (a blocking loader
 * would put the router's full-page pending screen over filter changes).
 */
export function prefetchReviewQueue(
  queryClient: QueryClient,
  search: ReviewSearch,
) {
  void queryClient.ensureQueryData(
    getShipmentsControllerFindAllQueryOptions(reviewListParams(search)),
  );
  void queryClient.prefetchQuery(
    getShipmentEventsControllerFindAllQueryOptions({
      limit: 200,
      type: ["review_requested"],
    }),
  );
  void queryClient.prefetchQuery(getShipmentsControllerStatsQueryOptions());
}
