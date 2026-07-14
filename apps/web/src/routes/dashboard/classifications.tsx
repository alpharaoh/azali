import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ClassificationEngine } from "#/components/classification-engine";
import {
  getProductsControllerListQueryOptions,
  getProductsControllerStatsQueryOptions,
  ProductsControllerListSortBy,
  ProductsControllerListSourceItem,
} from "#/generated/api";
import { getStoredRowsPerPage } from "#/lib/use-rows-per-page";

const classificationsSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  clientId: z.array(z.string()).optional().catch(undefined),
  source: z
    .array(z.enum(ProductsControllerListSourceItem))
    .optional()
    .catch(undefined),
  sortBy: z.enum(ProductsControllerListSortBy).optional().catch(undefined),
  sortDir: z.enum(["asc", "desc"]).optional().catch(undefined),
});

export type ClassificationsSearch = z.infer<typeof classificationsSearchSchema>;

export const Route = createFileRoute("/dashboard/classifications")({
  validateSearch: (search) => classificationsSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    // Mirrors the table's page-1 query for the current URL filters so
    // hover-preloading this route warms the exact cache entry it renders from.
    // Fire-and-forget: the table renders its own loading states.
    void context.queryClient.ensureQueryData(
      getProductsControllerListQueryOptions({
        search: deps.q,
        clientId: deps.clientId,
        source: deps.source,
        sortBy: deps.sortBy ?? "reuseCount",
        sortDir: deps.sortDir ?? "desc",
        limit: getStoredRowsPerPage(),
        offset: 0,
      }),
    );
    void context.queryClient.ensureQueryData(
      getProductsControllerStatsQueryOptions(),
    );
  },
  component: ClassificationsPage,
});

function ClassificationsPage() {
  return (
    <div className="p-4 pt-0">
      <ClassificationEngine />
    </div>
  );
}
