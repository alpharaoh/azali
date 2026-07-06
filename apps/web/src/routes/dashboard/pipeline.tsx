import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PipelineBoard } from "#/components/pipeline-board";
import {
  getClientsControllerFindAllQueryOptions,
  getShipmentsControllerFindAllQueryOptions,
  getShipmentsControllerStatsQueryOptions,
  ShipmentsControllerFindAllStatusItem,
} from "#/generated/api";
import { getStoredRowsPerPage } from "#/lib/use-rows-per-page";

const pipelineSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  status: z
    .array(z.enum(ShipmentsControllerFindAllStatusItem))
    .optional()
    .catch(undefined),
  /** Client ids. */
  client: z.array(z.string()).optional().catch(undefined),
  /** Inclusive value bounds in whole dollars. */
  valueMin: z.number().int().min(0).optional().catch(undefined),
  valueMax: z.number().int().min(0).optional().catch(undefined),
  sortBy: z
    .enum([
      "priority",
      "etaAt",
      "valueCents",
      "createdAt",
      "reference",
      "stage",
      "status",
    ])
    .optional()
    .catch(undefined),
  sortDir: z.enum(["asc", "desc"]).optional().catch(undefined),
});

export type PipelineSearch = z.infer<typeof pipelineSearchSchema>;

export function pipelineListParams(search: PipelineSearch, limit: number) {
  return {
    search: search.q,
    status: search.status,
    clientId: search.client,
    valueMin: search.valueMin !== undefined ? search.valueMin * 100 : undefined,
    valueMax: search.valueMax !== undefined ? search.valueMax * 100 : undefined,
    // Most urgent work first — P1s land at the top, done shipments last.
    sortBy: search.sortBy ?? "priority",
    sortDir: search.sortDir ?? "asc",
    limit,
    offset: 0,
  } as const;
}

export const Route = createFileRoute("/dashboard/pipeline")({
  validateSearch: (search) => pipelineSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  // Warm the cache without blocking navigation — the board renders its own
  // loading states (skeleton on first load, dimmed table while refetching).
  loader: ({ context, deps }) => {
    void context.queryClient.ensureQueryData(
      getShipmentsControllerFindAllQueryOptions(
        pipelineListParams(deps, getStoredRowsPerPage()),
      ),
    );
    void context.queryClient.prefetchQuery(
      getShipmentsControllerStatsQueryOptions(),
    );
    void context.queryClient.prefetchQuery(
      getClientsControllerFindAllQueryOptions({ limit: 100 }),
    );
  },
  component: PipelinePage,
});

function PipelinePage() {
  return (
    <div className="p-4 pt-0">
      <PipelineBoard />
    </div>
  );
}
