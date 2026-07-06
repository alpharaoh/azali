import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ClientsTable } from "#/components/clients-table";
import {
  ClientsControllerFindAllAutonomyItem,
  ClientsControllerFindAllSortBy,
  ClientsControllerFindAllStatusItem,
  getClientsControllerFindAllQueryOptions,
} from "#/generated/api";
import { getStoredRowsPerPage } from "#/lib/use-rows-per-page";

const clientsSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  status: z
    .array(z.enum(ClientsControllerFindAllStatusItem))
    .optional()
    .catch(undefined),
  autonomy: z
    .array(z.enum(ClientsControllerFindAllAutonomyItem))
    .optional()
    .catch(undefined),
  sortBy: z.enum(ClientsControllerFindAllSortBy).optional().catch(undefined),
  sortDir: z.enum(["asc", "desc"]).optional().catch(undefined),
});

export type ClientsSearch = z.infer<typeof clientsSearchSchema>;

export const Route = createFileRoute("/dashboard/clients")({
  validateSearch: (search) => clientsSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    // Mirrors the table's page-1 query for the current URL filters so
    // hover-preloading this route warms the exact cache entry it renders from.
    // Fire-and-forget: the table renders its own loading states.
    void context.queryClient.ensureQueryData(
      getClientsControllerFindAllQueryOptions({
        search: deps.q,
        status: deps.status,
        autonomy: deps.autonomy,
        sortBy: deps.sortBy ?? "createdAt",
        sortDir: deps.sortDir ?? "desc",
        limit: getStoredRowsPerPage(),
        offset: 0,
      }),
    );
  },
  component: Clients,
});

function Clients() {
  return (
    <div className="p-4 pt-0">
      <ClientsTable />
    </div>
  );
}
