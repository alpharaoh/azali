import { createFileRoute } from "@tanstack/react-router";
import { ShipmentDetail } from "#/components/shipment-detail";
import {
  getShipmentDocumentsControllerListQueryOptions,
  getShipmentEventsControllerFindByShipmentQueryOptions,
  getShipmentsControllerFindOneQueryOptions,
  getShipmentsControllerLinesQueryOptions,
} from "#/generated/api";

export const Route = createFileRoute("/dashboard/shipments/$shipmentId")({
  // Fire-and-forget cache warming — navigation never blocks; the page
  // renders skeletons for whatever hasn't landed yet.
  loader: ({ context, params }) => {
    void context.queryClient.ensureQueryData(
      getShipmentsControllerFindOneQueryOptions(params.shipmentId),
    );
    void context.queryClient.prefetchQuery(
      getShipmentEventsControllerFindByShipmentQueryOptions(params.shipmentId, {
        limit: 200,
      }),
    );
    void context.queryClient.prefetchQuery(
      getShipmentsControllerLinesQueryOptions(params.shipmentId),
    );
    void context.queryClient.prefetchQuery(
      getShipmentDocumentsControllerListQueryOptions(params.shipmentId),
    );
  },
  component: ShipmentDetailPage,
});

function ShipmentDetailPage() {
  const { shipmentId } = Route.useParams();

  return (
    <div className="p-4 pt-2">
      {/* Keyed so all per-shipment view state resets when navigating
          between shipments. */}
      <ShipmentDetail key={shipmentId} shipmentId={shipmentId} />
    </div>
  );
}
