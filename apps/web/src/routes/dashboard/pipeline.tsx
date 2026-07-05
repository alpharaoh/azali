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
    .enum(["etaAt", "valueCents", "createdAt", "reference"])
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
    sortBy: search.sortBy ?? "etaAt",
    sortDir: search.sortDir ?? "asc",
    limit,
    offset: 0,
  } as const;
}

export const Route = createFileRoute("/dashboard/pipeline")({
  validateSearch: (search) => pipelineSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        getShipmentsControllerFindAllQueryOptions(
          pipelineListParams(deps, getStoredRowsPerPage()),
        ),
      ),
      context.queryClient.prefetchQuery(
        getShipmentsControllerStatsQueryOptions(),
      ),
      context.queryClient.prefetchQuery(
        getClientsControllerFindAllQueryOptions({ limit: 100 }),
      ),
    ]),
  component: PipelinePage,
});

function PipelinePage() {
  return (
    <div className="p-4 pt-0">
      <PipelineBoard />
    </div>
  );
}
