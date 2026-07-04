import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "#/components/page-placeholder";

export const Route = createFileRoute("/dashboard/settings")({
  component: Settings,
});

function Settings() {
  return (
    <PagePlaceholder
      description="Roles and licensed-broker sign-off authority, plus autonomy thresholds — what confidence level auto-files versus what queues for human review."
      title="Settings"
    />
  );
}
