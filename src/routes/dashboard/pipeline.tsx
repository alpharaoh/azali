import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "#/components/page-placeholder";

export const Route = createFileRoute("/dashboard/pipeline")({
	component: Pipeline,
});

function Pipeline() {
	return (
		<PagePlaceholder
			description="Every shipment as a live status stream: what stage it's in, what the AI has done, what it's waiting on, and ETA to clearance. Green flows through untouched; red pops to the Review Queue."
			title="Pipeline"
		/>
	);
}
