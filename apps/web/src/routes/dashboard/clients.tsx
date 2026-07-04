import { createFileRoute } from "@tanstack/react-router";
import { ClientsTable } from "#/components/clients-table";
import { getClientsControllerFindAllQueryOptions } from "#/generated/api";
import { getStoredRowsPerPage } from "#/lib/use-rows-per-page";

export const Route = createFileRoute("/dashboard/clients")({
  loader: ({ context }) =>
    // Matches the table's initial query (default sort, page 1, no filters) so
    // hover-preloading this route warms the exact cache entry it renders from.
    context.queryClient.ensureQueryData(
      getClientsControllerFindAllQueryOptions({
        sortBy: "createdAt",
        sortDir: "desc",
        limit: getStoredRowsPerPage(),
        offset: 0,
      }),
    ),
  component: Clients,
});

function Clients() {
  return (
    <div className="p-4 pt-0">
      <ClientsTable />
    </div>
  );
}
