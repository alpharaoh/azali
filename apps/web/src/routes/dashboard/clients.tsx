import { createFileRoute } from "@tanstack/react-router";
import { ClientsTable } from "#/components/clients-table";

export const Route = createFileRoute("/dashboard/clients")({
	component: Clients,
});

function Clients() {
	return (
		<div className="p-4 pt-0">
			<ClientsTable />
		</div>
	);
}
