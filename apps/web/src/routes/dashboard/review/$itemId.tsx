import { createFileRoute } from "@tanstack/react-router";
import { ReviewWorkspace } from "#/components/review-workspace";
import {
  getShipmentEventsControllerFindByShipmentQueryOptions,
  getShipmentsControllerFindOneQueryOptions,
  getShipmentsControllerLinesQueryOptions,
} from "#/generated/api";

export const Route = createFileRoute("/dashboard/review/$itemId")({
  // Fire-and-forget cache warming — navigation never blocks; the page
  // renders skeletons for whatever hasn't landed yet.
  loader: ({ context, params }) => {
    void context.queryClient.ensureQueryData(
      getShipmentsControllerFindOneQueryOptions(params.itemId),
    );
    void context.queryClient.prefetchQuery(
      getShipmentEventsControllerFindByShipmentQueryOptions(params.itemId, {
        limit: 200,
      }),
    );
    void context.queryClient.prefetchQuery(
      getShipmentsControllerLinesQueryOptions(params.itemId),
    );
  },
  component: ReviewItemPage,
});

function ReviewItemPage() {
  const { itemId } = Route.useParams();

  return (
    <div className="p-4 pt-2">
      {/* Keyed so all per-review state resets when navigating between items. */}
      <ReviewWorkspace key={itemId} shipmentId={itemId} />
    </div>
  );
}
