import { createFileRoute } from "@tanstack/react-router";
import { TariffRadarOverview } from "#/components/tariff-radar-overview";

export const Route = createFileRoute("/dashboard/tariff-radar")({
	component: TariffRadar,
});

function TariffRadar() {
	return (
		<div className="p-4 pt-0">
			<TariffRadarOverview />
		</div>
	);
}
