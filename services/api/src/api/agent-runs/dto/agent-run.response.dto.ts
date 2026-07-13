import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const agentRunSummarySchema = z.object({
  id: z.string().describe("Run id."),
  agent: z.string().describe("Which AI workflow ran, e.g. classification."),
  status: z.string().describe("running (in progress), completed, or failed."),
  model: z.string().describe("The AI model used."),
  promptName: z
    .string()
    .nullable()
    .describe("The managed prompt used, when applicable."),
  promptVersion: z.number().nullable().describe("The prompt version used."),
  result: z
    .looseObject({})
    .nullable()
    .describe("The run's final structured result, when completed."),
  error: z.string().nullable().describe("Failure reason, when failed."),
  stepCount: z.number().describe("How many reasoning passes the run took."),
  toolCallCount: z.number().describe("How many research actions it performed."),
  inputTokens: z.number().nullable(),
  outputTokens: z.number().nullable(),
  totalTokens: z.number().nullable(),
  startedAt: z.string().describe("When the run started."),
  completedAt: z.string().nullable().describe("When the run finished."),
  durationMs: z.number().nullable().describe("Total runtime in milliseconds."),
});

export class ListAgentRunsResponseDto extends createZodDto(
  z.object({
    runs: z
      .array(agentRunSummarySchema)
      .describe("The shipment's AI runs, newest first."),
  }),
) {}

const agentRunItemSchema = z.object({
  stepIndex: z.number().describe("Which reasoning pass this belongs to."),
  itemIndex: z.number().describe("Order within the pass."),
  kind: z
    .string()
    .describe(
      "reasoning (the AI's thinking), tool_call (a research action), tool_result (what it found), or text.",
    ),
  toolName: z
    .string()
    .nullable()
    .describe("The research action, when applicable."),
  toolCallId: z
    .string()
    .nullable()
    .describe("Pairs a research action with its finding."),
  content: z
    .looseObject({})
    .describe(
      "The item's full content — reasoning text, action input, or findings.",
    ),
  createdAt: z.string().describe("When it happened."),
});

export class AgentRunDetailResponseDto extends createZodDto(
  z.object({
    run: agentRunSummarySchema,
    items: z
      .array(agentRunItemSchema)
      .describe(
        "The complete ordered record of the run — every reasoning passage, research action, and finding.",
      ),
  }),
) {}
