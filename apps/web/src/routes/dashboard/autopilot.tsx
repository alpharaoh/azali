import { createFileRoute } from "@tanstack/react-router";
import { AutopilotLog } from "#/components/autopilot-log";
import {
  getClientsControllerFindAllQueryOptions,
  getShipmentEventsControllerFindAllQueryOptions,
  getShipmentsControllerFindAllQueryOptions,
} from "#/generated/api";

export const Route = createFileRoute("/dashboard/autopilot")({
  // Fire-and-forget cache warming; the log renders its own loading states.
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(
      getShipmentEventsControllerFindAllQueryOptions({
        actor: ["ai"],
        limit: 200,
      }),
    );
    void context.queryClient.prefetchQuery(
      getShipmentsControllerFindAllQueryOptions({ limit: 100 }),
    );
    void context.queryClient.prefetchQuery(
      getClientsControllerFindAllQueryOptions({ limit: 100 }),
    );
  },
  component: AutopilotPage,
});

function AutopilotPage() {
  return (
    <div className="p-4 pt-0">
      <AutopilotLog />
    </div>
  );
}
