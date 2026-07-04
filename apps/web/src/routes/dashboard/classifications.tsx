import { createFileRoute } from "@tanstack/react-router";
import { ClassificationEngine } from "#/components/classification-engine";

export const Route = createFileRoute("/dashboard/classifications")({
  component: ClassificationsPage,
});

function ClassificationsPage() {
  return (
    <div className="p-4 pt-0">
      <ClassificationEngine />
    </div>
  );
}
