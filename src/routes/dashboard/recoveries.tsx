import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "#/components/page-placeholder";

export const Route = createFileRoute("/dashboard/recoveries")({
	component: Recoveries,
});

function Recoveries() {
	return (
		<PagePlaceholder
			description="Drawback and refund opportunities the AI surfaces from entry history, and claims in flight. Money found, not hours billed."
			title="Recoveries"
		/>
	);
}
