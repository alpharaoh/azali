import { createFileRoute } from "@tanstack/react-router";
import { ReviewQueue } from "#/components/review-queue";
import {
  prefetchReviewQueue,
  reviewSearchSchema,
} from "#/lib/review-queue-loader";

export const Route = createFileRoute("/dashboard/review/")({
  validateSearch: (search) => reviewSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => prefetchReviewQueue(context.queryClient, deps),
  component: ReviewQueuePage,
});

function ReviewQueuePage() {
  return (
    <div className="p-4 pt-0">
      <ReviewQueue />
    </div>
  );
}
