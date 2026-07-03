import { createFileRoute } from "@tanstack/react-router";
import { ReviewQueue } from "#/components/review-queue";

export const Route = createFileRoute("/dashboard/review")({
	component: ReviewQueuePage,
});

function ReviewQueuePage() {
	return (
		<div className="p-4 pt-0">
			<ReviewQueue />
		</div>
	);
}
