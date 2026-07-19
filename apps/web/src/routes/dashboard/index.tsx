import { createFileRoute } from "@tanstack/react-router";
import { HomeOverview } from "#/components/home/home-overview";
import {
  HOME_EVENTS_PARAMS,
  HOME_LATEST_PARAMS,
  HOME_REVIEWS_PARAMS,
  HOME_SHIPMENTS_PARAMS,
} from "#/components/home/home-params";
import {
  getProductsControllerStatsQueryOptions,
  getShipmentEventsControllerFindAllQueryOptions,
  getShipmentsControllerFindAllQueryOptions,
  getShipmentsControllerStatsQueryOptions,
} from "#/generated/api";

export const Route = createFileRoute("/dashboard/")({
  // Warm every home query without blocking navigation — each block renders
  // its own skeleton while its data is in flight.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(
      getShipmentsControllerStatsQueryOptions(),
    );
    void context.queryClient.prefetchQuery(
      getShipmentsControllerFindAllQueryOptions(HOME_REVIEWS_PARAMS),
    );
    void context.queryClient.prefetchQuery(
      getShipmentsControllerFindAllQueryOptions(HOME_SHIPMENTS_PARAMS),
    );
    void context.queryClient.prefetchQuery(
      getShipmentsControllerFindAllQueryOptions(HOME_LATEST_PARAMS),
    );
    void context.queryClient.prefetchQuery(
      getShipmentEventsControllerFindAllQueryOptions(HOME_EVENTS_PARAMS),
    );
    void context.queryClient.prefetchQuery(
      getProductsControllerStatsQueryOptions(),
    );
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="p-4 pt-0">
      <HomeOverview />
    </div>
  );
}
