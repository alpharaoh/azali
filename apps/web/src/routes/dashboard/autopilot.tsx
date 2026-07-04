import { createFileRoute } from "@tanstack/react-router";
import { AutopilotLog } from "#/components/autopilot-log";

export const Route = createFileRoute("/dashboard/autopilot")({
  component: AutopilotPage,
});

function AutopilotPage() {
  return (
    <div className="p-4 pt-0">
      <AutopilotLog />
    </div>
  );
}
