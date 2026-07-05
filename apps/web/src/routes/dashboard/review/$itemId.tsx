import { createFileRoute } from "@tanstack/react-router";
import { ReviewQueue } from "#/components/review-queue";
import { prefetchReviewQueue } from "#/lib/review-queue-loader";

export const Route = createFileRoute("/dashboard/review/$itemId")({
  loader: ({ context }) => prefetchReviewQueue(context.queryClient),
  component: ReviewItemPage,
});

function ReviewItemPage() {
  return (
    <div className="px-4">
      <ReviewQueue />
    </div>
  );
}
