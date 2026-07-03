import { createFileRoute } from "@tanstack/react-router";
import { ReviewQueue } from "#/components/review-queue";

export const Route = createFileRoute("/dashboard/review")({
	component: ReviewQueuePage,
});

function ReviewQueuePage() {
	return (
		<div className="px-4">
			<ReviewQueue />
		</div>
	);
}
