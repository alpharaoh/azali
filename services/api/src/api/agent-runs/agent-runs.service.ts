import { Injectable, NotFoundException } from "@nestjs/common";
import { listAgentRunItems } from "@/db/queries/select/many/listAgentRunItems";
import { listAgentRuns } from "@/db/queries/select/many/listAgentRuns";
import { selectAgentRun } from "@/db/queries/select/one/selectAgentRun";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import type { SelectAgentRun, SelectAgentRunItem } from "@/db/schema";

function toRunSummary(run: SelectAgentRun) {
  return {
    id: run.id,
    agent: run.agent,
    status: run.status,
    promptName: run.promptName,
    promptVersion: run.promptVersion,
    result: run.result,
    error: run.error,
    stepCount: run.stepCount,
    toolCallCount: run.toolCallCount,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    totalTokens: run.totalTokens,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    durationMs: run.durationMs,
  };
}

function toRunItem(item: SelectAgentRunItem) {
  return {
    stepIndex: item.stepIndex,
    itemIndex: item.itemIndex,
    kind: item.kind,
    toolName: item.toolName,
    toolCallId: item.toolCallId,
    content: item.content,
    createdAt: item.createdAt.toISOString(),
  };
}

@Injectable()
export class AgentRunsService {
  async listForShipment(organizationId: string, shipmentId: string) {
    const shipment = await selectShipment(shipmentId, organizationId);
    if (!shipment) {
      throw new NotFoundException(`Shipment "${shipmentId}" not found`);
    }

    const { data } = await listAgentRuns({ organizationId, shipmentId });
    return { runs: data.map(toRunSummary) };
  }

  async find(organizationId: string, id: string) {
    const run = await selectAgentRun(id, organizationId);
    if (!run) {
      throw new NotFoundException(`Run "${id}" not found`);
    }

    const items = await listAgentRunItems(id, organizationId);
    return { run: toRunSummary(run), items: items.map(toRunItem) };
  }
}
