import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "#/components/page-placeholder";

export const Route = createFileRoute("/dashboard/tariff-radar")({
	component: TariffRadar,
});

function TariffRadar() {
	return (
		<PagePlaceholder
			description="HTS, Section 301, and Section 232 changes auto-mapped against the catalog. When a rate changes, affected SKUs are re-run automatically — only the exceptions need review."
			title="Tariff Radar"
		/>
	);
}
