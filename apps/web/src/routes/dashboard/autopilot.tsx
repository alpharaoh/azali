import { createFileRoute } from "@tanstack/react-router";
import { AutopilotLog } from "#/components/autopilot-log";
import {
  getClientsControllerFindAllQueryOptions,
  getShipmentEventsControllerFindAllQueryOptions,
  getShipmentsControllerFindAllQueryOptions,
} from "#/generated/api";

export const Route = createFileRoute("/dashboard/autopilot")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        getShipmentEventsControllerFindAllQueryOptions({
          actor: ["ai"],
          limit: 200,
        }),
      ),
      context.queryClient.prefetchQuery(
        getShipmentsControllerFindAllQueryOptions({ limit: 100 }),
      ),
      context.queryClient.prefetchQuery(
        getClientsControllerFindAllQueryOptions({ limit: 100 }),
      ),
    ]),
  component: AutopilotPage,
});

function AutopilotPage() {
  return (
    <div className="p-4 pt-0">
      <AutopilotLog />
    </div>
  );
}
