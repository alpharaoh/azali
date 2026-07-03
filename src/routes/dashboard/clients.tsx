import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "#/components/page-placeholder";

export const Route = createFileRoute("/dashboard/clients")({
	component: Clients,
});

function Clients() {
	return (
		<PagePlaceholder
			description="Importer profiles, bonds, POAs, and catalogs — plus the client-facing status portal, so clients see where their shipments are without emailing us."
			title="Clients"
		/>
	);
}
