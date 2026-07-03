import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "#/components/page-placeholder";

export const Route = createFileRoute("/dashboard/autopilot")({
	component: AutopilotLog,
});

function AutopilotLog() {
	return (
		<PagePlaceholder
			description="Everything the AI did without human intervention: docs ingested, classifications assigned, entries filed, statements reconciled. Spot-check here to tune autonomy thresholds and keep a defensible record for CBP."
			title="Autopilot Log"
		/>
	);
}
