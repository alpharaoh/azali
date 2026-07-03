import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "#/components/page-placeholder";

export const Route = createFileRoute("/dashboard/classifications")({
	component: ClassificationBrain,
});

function ClassificationBrain() {
	return (
		<PagePlaceholder
			description="The per-client product catalog mapped to HTS codes — each with its rationale, CROSS citations, and decision history. Every human correction in the Review Queue feeds back here."
			title="Classification Brain"
		/>
	);
}
