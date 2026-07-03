import { createFileRoute } from "@tanstack/react-router";
import { PipelineBoard } from "#/components/pipeline-board";

export const Route = createFileRoute("/dashboard/pipeline")({
	component: PipelinePage,
});

function PipelinePage() {
	return (
		<div className="p-4 pt-0">
			<PipelineBoard />
		</div>
	);
}
