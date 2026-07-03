import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "#/components/page-placeholder";

export const Route = createFileRoute("/dashboard/billing")({
	component: Billing,
});

function Billing() {
	return (
		<PagePlaceholder
			description="AI-reconciled billing: duty statements matched to entries matched to client invoices automatically. Exceptions go to the Review Queue."
			title="Billing"
		/>
	);
}
