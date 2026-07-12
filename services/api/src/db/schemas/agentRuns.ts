import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { shipments } from "@/db/schemas/shipments";
import { getDefaultColumns } from "@/db/utils/getDefaultColumns";
import { getDefaultOwnershipColumns } from "@/db/utils/getDefaultOwnershipColumns";
import { jsonbObject } from "@/db/utils/jsonbObject";

export enum AgentRunStatus {
  Running = "running",
  Completed = "completed",
  Failed = "failed",
}

export enum AgentRunItemKind {
  Reasoning = "reasoning",
  ToolCall = "tool_call",
  ToolResult = "tool_result",
  Text = "text",
}

export const agentRunStatus = pgEnum("agent_run_status", AgentRunStatus);
export const agentRunItemKind = pgEnum("agent_run_item_kind", AgentRunItemKind);

/**
 * One row per agent invocation — the canonical audit record of AI work.
 * Frontend views are projections of this store, never the other way around.
 */
export const agentRuns = pgTable(
  "agent_runs",
  {
    ...getDefaultColumns(),
    ...getDefaultOwnershipColumns(),
    shipmentId: text("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    /** Which agent ran, e.g. "classification". */
    agent: text("agent").notNull(),
    status: agentRunStatus("status").notNull().default(AgentRunStatus.Running),
    model: text("model").notNull(),
    /** The managed prompt version actually used; null when on fallback. */
    promptName: text("prompt_name"),
    promptVersion: integer("prompt_version"),
    /** The context handed to the agent. */
    input: jsonbObject("input").notNull().default(sql`'{}'::jsonb`),
    /** The final structured output, verbatim. */
    result: jsonbObject("result"),
    error: text("error"),
    /** OpenTelemetry/Langfuse trace id for cross-referencing observability. */
    traceId: text("trace_id"),
    stepCount: integer("step_count").notNull().default(0),
    toolCallCount: integer("tool_call_count").notNull().default(0),
    inputTokens: bigint("input_tokens", { mode: "number" }),
    outputTokens: bigint("output_tokens", { mode: "number" }),
    totalTokens: bigint("total_tokens", { mode: "number" }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
  },
  (table) => [
    index("agent_runs_shipment_idx").on(table.shipmentId),
    index("agent_runs_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("agent_runs_org_agent_idx").on(table.organizationId, table.agent),
  ],
);

/**
 * Append-only, one row per unit of agent work: a reasoning passage, a tool
 * call, a tool result, or emitted text. Item-level rows keep audit questions
 * ("every ruling the AI consulted") a single indexed query.
 */
export const agentRunItems = pgTable(
  "agent_run_items",
  {
    ...getDefaultColumns(),
    ...getDefaultOwnershipColumns(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    stepIndex: integer("step_index").notNull(),
    itemIndex: integer("item_index").notNull(),
    kind: agentRunItemKind("kind").notNull(),
    toolName: text("tool_name"),
    toolCallId: text("tool_call_id"),
    /**
     * { text } for reasoning/text; { input } for tool_call;
     * { output, truncated? } for tool_result (large outputs are clamped —
     * the source systems remain the full-fidelity record).
     */
    content: jsonbObject("content").notNull().default(sql`'{}'::jsonb`),
  },
  (table) => [
    index("agent_run_items_run_idx").on(
      table.runId,
      table.stepIndex,
      table.itemIndex,
    ),
    index("agent_run_items_org_tool_idx").on(
      table.organizationId,
      table.toolName,
    ),
  ],
);

export type SelectAgentRun = typeof agentRuns.$inferSelect;
export type InsertAgentRun = typeof agentRuns.$inferInsert;
export type SelectAgentRunItem = typeof agentRunItems.$inferSelect;
export type InsertAgentRunItem = typeof agentRunItems.$inferInsert;
