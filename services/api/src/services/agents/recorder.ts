import { insertAgentRun } from "@/db/queries/insert/insertAgentRun";
import { insertAgentRunItems } from "@/db/queries/insert/insertAgentRunItems";
import { updateAgentRun } from "@/db/queries/update/updateAgentRun";
import {
  AgentRunItemKind,
  AgentRunStatus,
  type InsertAgentRunItem,
} from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-recorder");

/**
 * Oversized tool outputs are clamped to a preview — the source systems
 * (CROSS, HTS, S3) remain the full-fidelity record for those payloads.
 */
const MAX_CONTENT_BYTES = 64_000;

function clampOutput(output: unknown): Record<string, unknown> {
  const serialized = JSON.stringify(output);
  if (serialized && serialized.length > MAX_CONTENT_BYTES) {
    return { preview: serialized.slice(0, MAX_CONTENT_BYTES), truncated: true };
  }
  return { output };
}

export interface StartAgentRunParams {
  organizationId: string;
  userId: string;
  shipmentId?: string | null;
  agent: string;
  model: string;
  promptName?: string | null;
  promptVersion?: number | null;
  input: Record<string, unknown>;
  traceId?: string | null;
}

/**
 * The canonical audit record of an agent run. Steps are persisted
 * incrementally so even crashed runs leave their partial trail. Recorder
 * failures are logged and swallowed — auditing must never break the run.
 */
export class AgentRunRecorder {
  private stepCount = 0;
  private toolCallCount = 0;
  private readonly startedAt = Date.now();

  private constructor(
    /** Null when the initial insert failed — recorder becomes a no-op. */
    readonly runId: string | null,
    private readonly organizationId: string,
    private readonly userId: string,
  ) {}

  static async start(params: StartAgentRunParams): Promise<AgentRunRecorder> {
    try {
      const run = await insertAgentRun({
        organizationId: params.organizationId,
        userId: params.userId,
        shipmentId: params.shipmentId ?? null,
        agent: params.agent,
        status: AgentRunStatus.Running,
        model: params.model,
        promptName: params.promptName ?? null,
        promptVersion: params.promptVersion ?? null,
        input: params.input,
        traceId: params.traceId ?? null,
      });
      return new AgentRunRecorder(run.id, params.organizationId, params.userId);
    } catch (error) {
      log.error(
        { err: error, agent: params.agent, shipmentId: params.shipmentId },
        "failed to start run record — continuing without audit trail",
      );
      return new AgentRunRecorder(null, params.organizationId, params.userId);
    }
  }

  private stepIndex = 0;
  private itemIndex = 0;

  /**
   * Persist one unit of agent work the moment it happens — reasoning as it
   * concludes, tool calls as they're issued, results as they land. The audit
   * trail is live, not written after the fact.
   */
  async recordItem(item: {
    kind: AgentRunItemKind;
    toolName?: string;
    toolCallId?: string;
    content: Record<string, unknown>;
  }): Promise<void> {
    if (item.kind === AgentRunItemKind.ToolCall) this.toolCallCount++;
    if (this.itemIndex === 0) this.stepCount++;
    const itemIndex = this.itemIndex++;
    if (!this.runId) return;

    const row: InsertAgentRunItem = {
      runId: this.runId,
      organizationId: this.organizationId,
      userId: this.userId,
      stepIndex: this.stepIndex,
      itemIndex,
      kind: item.kind,
      toolName: item.toolName ?? null,
      toolCallId: item.toolCallId ?? null,
      content:
        item.kind === AgentRunItemKind.ToolResult && "output" in item.content
          ? clampOutput(item.content.output)
          : item.content,
    };

    try {
      await insertAgentRunItems([row]);
    } catch (error) {
      log.error(
        { err: error, runId: this.runId, stepIndex: this.stepIndex, itemIndex },
        "failed to persist run item",
      );
    }
  }

  /** Called at each loop-step boundary. */
  advanceStep(): void {
    if (this.itemIndex === 0) return;
    this.stepIndex++;
    this.itemIndex = 0;
  }

  async complete({
    result,
    usage,
    model,
  }: {
    result: Record<string, unknown>;
    usage: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
    /** The model that actually finished the run (capacity fallbacks). */
    model?: string;
  }): Promise<void> {
    await this.finalize({
      status: AgentRunStatus.Completed,
      result,
      usage,
      model,
    });
  }

  async fail(error: unknown): Promise<void> {
    await this.finalize({
      status: AgentRunStatus.Failed,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  private async finalize(values: {
    status: AgentRunStatus;
    result?: Record<string, unknown>;
    error?: string;
    model?: string;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
  }): Promise<void> {
    if (!this.runId) return;
    try {
      await updateAgentRun(this.runId, this.organizationId, {
        status: values.status,
        ...(values.model ? { model: values.model } : {}),
        result: values.result ?? null,
        error: values.error ?? null,
        inputTokens: values.usage?.inputTokens ?? null,
        outputTokens: values.usage?.outputTokens ?? null,
        totalTokens: values.usage?.totalTokens ?? null,
        stepCount: this.stepCount,
        toolCallCount: this.toolCallCount,
        completedAt: new Date(),
        durationMs: Date.now() - this.startedAt,
      });
    } catch (error) {
      // The run itself succeeded/failed independently — but an unfinalized
      // audit row is a serious gap, so shout.
      log.fatal(
        { err: error, runId: this.runId, status: values.status },
        "failed to finalize audit run row",
      );
    }
  }
}
