import { createFileRoute } from "@tanstack/react-router";
import { ReviewQueue } from "#/components/review-queue";
import {
  getClientsControllerFindAllQueryOptions,
  getShipmentEventsControllerFindAllQueryOptions,
  getShipmentsControllerFindAllQueryOptions,
} from "#/generated/api";

export const Route = createFileRoute("/dashboard/review")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        getShipmentsControllerFindAllQueryOptions({
          status: ["needs_review"],
          sortBy: "reviewDeadlineAt",
          sortDir: "asc",
          limit: 100,
        }),
      ),
      context.queryClient.prefetchQuery(
        getShipmentEventsControllerFindAllQueryOptions({
          type: ["review_requested"],
          limit: 200,
        }),
      ),
      context.queryClient.prefetchQuery(
        getClientsControllerFindAllQueryOptions({ limit: 100 }),
      ),
    ]),
  component: ReviewQueuePage,
});

function ReviewQueuePage() {
  return (
    <div className="px-4">
      <ReviewQueue />
    </div>
  );
}
