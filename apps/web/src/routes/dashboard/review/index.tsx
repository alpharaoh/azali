import { createFileRoute } from "@tanstack/react-router";
import { ReviewQueue } from "#/components/review-queue";
import { prefetchReviewQueue } from "#/lib/review-queue-loader";

export const Route = createFileRoute("/dashboard/review/")({
  loader: ({ context }) => prefetchReviewQueue(context.queryClient),
  component: ReviewQueuePage,
});

function ReviewQueuePage() {
  return (
    <div className="px-4">
      <ReviewQueue />
    </div>
  );
}
