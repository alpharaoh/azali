import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "#/components/page-placeholder";

export const Route = createFileRoute("/dashboard/review")({
	component: ReviewQueue,
});

function ReviewQueue() {
	return (
		<PagePlaceholder
			description="Everything the AI wasn't confident enough to do alone, ranked by deadline and risk. Approve or correct — don't do."
			stat={
				<div className="bg-surface rounded-xl border px-4 py-3">
					<p className="text-muted text-xs">Touches per entry</p>
					<p className="text-foreground text-2xl font-semibold">2.4</p>
				</div>
			}
			title="Review Queue"
		/>
	);
}
