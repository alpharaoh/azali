import { createFileRoute } from "@tanstack/react-router";
import { ReviewQueue } from "#/components/review-queue";
import {
  prefetchReviewQueue,
  reviewSearchSchema,
} from "#/lib/review-queue-loader";

export const Route = createFileRoute("/dashboard/review/$itemId")({
  validateSearch: (search) => reviewSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => prefetchReviewQueue(context.queryClient, deps),
  component: ReviewItemPage,
});

function ReviewItemPage() {
  return (
    <div className="px-4 py-3">
      <ReviewQueue />
    </div>
  );
}
