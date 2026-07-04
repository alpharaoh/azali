import { createFileRoute } from "@tanstack/react-router";
import { RecoveriesOverview } from "#/components/recoveries-overview";

export const Route = createFileRoute("/dashboard/recoveries")({
	component: Recoveries,
});

function Recoveries() {
	return (
		<div className="p-4 pt-0">
			<RecoveriesOverview />
		</div>
	);
}
