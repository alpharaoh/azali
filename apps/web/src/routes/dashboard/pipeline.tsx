import { createFileRoute } from "@tanstack/react-router";
import { PipelineBoard } from "#/components/pipeline-board";
import {
  getClientsControllerFindAllQueryOptions,
  getShipmentsControllerFindAllQueryOptions,
} from "#/generated/api";

export const Route = createFileRoute("/dashboard/pipeline")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        getShipmentsControllerFindAllQueryOptions({ limit: 100 }),
      ),
      context.queryClient.prefetchQuery(
        getClientsControllerFindAllQueryOptions({ limit: 100 }),
      ),
    ]),
  component: PipelinePage,
});

function PipelinePage() {
  return (
    <div className="p-4 pt-0">
      <PipelineBoard />
    </div>
  );
}
