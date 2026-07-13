import { propagateAttributes } from "@langfuse/tracing";
import { generateText, Output, stepCountIs, ToolLoopAgent } from "ai";
import { getOrganizationSlug } from "@/db/lib/getOrganizationSlug";
import type { DocumentExtraction, ShipmentDocumentCategory } from "@/db/schema";
import { AgentRunItemKind } from "@/db/schema";
import { anthropic } from "@/services/external/anthropic/client";
import { crossRulingsTools } from "@/services/external/cross/tools";
import { resolvePrompt } from "@/services/external/langfuse/prompts";
import { createKnowledgeBaseTools } from "@/services/external/pinecone/tools";
import { htsTools } from "@/services/external/usitc/tools";
import { AgentRunRecorder } from "../recorder";
import {
  CLASSIFICATION_PROMPT_NAME,
  CLASSIFICATION_SYSTEM_PROMPT,
} from "./prompt";
import {
  type ClassificationResult,
  classificationResultSchema,
} from "./schema";

const CLASSIFICATION_MODEL = "claude-opus-4-8";
/** Used when the primary model's endpoint is overloaded. */
const FALLBACK_MODEL = "claude-sonnet-4-6";
const MAX_STEPS = 24;
const isValidHtsCode = (code: string) => /^\d{4}\.\d{2}\.\d{2,4}/.test(code);

export interface ClassificationShipmentFacts {
  id: string;
  reference: string;
  clientName: string | null;
  originCountry: string;
  valueCents: number;
}

export interface ClassificationDocument {
  fileName: string;
  category: ShipmentDocumentCategory;
  extraction: DocumentExtraction;
}

export interface ClassificationOutcome {
  result: ClassificationResult;
  /** The canonical audit record (agent_runs.id); null if recording failed. */
  runId: string | null;
}

function buildDossier(
  shipment: ClassificationShipmentFacts,
  documents: ClassificationDocument[],
): string {
  const sections = documents.map((document) => {
    const fields = document.extraction.fields
      .map((field) => `- ${field.label}: ${field.value}`)
      .join("\n");
    return [
      `### ${document.fileName} (${document.category.replace(/_/g, " ")})`,
      document.extraction.summary,
      fields,
    ].join("\n");
  });

  return [
    "## Shipment",
    `- Reference: ${shipment.reference}`,
    `- Importer: ${shipment.clientName ?? "unknown"}`,
    `- Country of origin: ${shipment.originCountry}`,
    `- Commercial value: $${(shipment.valueCents / 100).toLocaleString("en-US")}`,
    "",
    "## Documents (extracted)",
    ...sections,
    "",
    "Classify the goods on this shipment. Any HS/HTS code appearing in the documents is a supplier hypothesis to verify, not ground truth.",
    "",
    "Before you answer: verify candidate headings with searchHts, read the governing notes with getChapterNotes, check precedent with searchRulings (and read the strongest hits with getRuling), and confirm the exact statistical line with browseHtsHeading. Your citations must come from lookups made in this run — start with your first tool call now.",
  ].join("\n");
}

export class ClassificationAgentService {
  static async classify({
    organizationId,
    userId,
    shipment,
    documents,
  }: {
    organizationId: string;
    userId: string;
    shipment: ClassificationShipmentFacts;
    documents: ClassificationDocument[];
  }): Promise<ClassificationOutcome> {
    const systemPrompt = await resolvePrompt(
      CLASSIFICATION_PROMPT_NAME,
      CLASSIFICATION_SYSTEM_PROMPT,
    );
    const organizationSlug = await getOrganizationSlug(organizationId);
    const dossier = buildDossier(shipment, documents);

    const recorder = await AgentRunRecorder.start({
      organizationId,
      userId,
      shipmentId: shipment.id,
      agent: "classification",
      model: CLASSIFICATION_MODEL,
      promptName: systemPrompt.prompt ? CLASSIFICATION_PROMPT_NAME : null,
      promptVersion: systemPrompt.prompt?.version ?? null,
      input: {
        dossier,
        reference: shipment.reference,
        documents: documents.map((document) => ({
          fileName: document.fileName,
          category: document.category,
        })),
      },
    });

    // The agent loop: think → call tools → observe → repeat, until the
    // evidence converges and the structured classification is emitted.
    const buildAgent = (model: string) =>
      new ToolLoopAgent({
        model: anthropic(model),
        instructions: systemPrompt.text,
        tools: {
          ...htsTools,
          ...crossRulingsTools,
          ...createKnowledgeBaseTools(organizationId),
          // Provider-executed on Anthropic's side — results carry real URLs.
          webSearch: anthropic.tools.webSearch_20260209({ maxUses: 6 }),
        },
        stopWhen: stepCountIs(MAX_STEPS),
        output: Output.object({ schema: classificationResultSchema }),
        // Thinking tokens count toward the output budget — keep headroom, but
        // don't let the default (model maximum) inflate request time
        // estimates. Summarized thinking streams the reasoning into the
        // audit record; Opus thinks adaptively, Sonnet on a budget.
        maxOutputTokens: 24_000,
        providerOptions: {
          anthropic: {
            thinking: model.includes("opus")
              ? { type: "adaptive", display: "summarized" }
              : { type: "enabled", budgetTokens: 8_000 },
          },
        },
      });

    let activeModel = CLASSIFICATION_MODEL;
    let agent = buildAgent(activeModel);

    try {
      const { output, usage } = await propagateAttributes(
        {
          traceName: "hts-classification",
          userId,
          sessionId: shipment.id,
          tags: ["classification"],
          metadata: {
            organizationId,
            organizationSlug,
            reference: shipment.reference,
          },
        },
        async () => {
          const callOptions = {
            // The real deadline — replaces Bun's per-request fetch timeout.
            timeout: { totalMs: 900_000, stepMs: 420_000 },
            ...(systemPrompt.prompt
              ? { runtimeContext: { langfusePrompt: systemPrompt.prompt } }
              : {}),
            telemetry: {
              functionId: "hts-classification",
              ...(systemPrompt.prompt
                ? { includeRuntimeContext: { langfusePrompt: true } }
                : {}),
            },
          };

          // Stream the loop so every unit of work is auditable the moment it
          // happens — reasoning, tool calls, and results land in the run
          // record live. Returns how many tool calls the pass made.
          const consume = async (
            activeStream: Awaited<ReturnType<typeof agent.stream>>,
          ): Promise<number> => {
            const buffers = new Map<string, string>();
            let toolCalls = 0;

            for await (const part of activeStream.fullStream) {
              switch (part.type) {
                case "reasoning-delta":
                case "text-delta":
                  buffers.set(
                    part.id,
                    (buffers.get(part.id) ?? "") + part.text,
                  );
                  break;
                case "reasoning-end": {
                  const text = buffers.get(part.id)?.trim();
                  buffers.delete(part.id);
                  if (text) {
                    await recorder.recordItem({
                      kind: AgentRunItemKind.Reasoning,
                      content: { text },
                    });
                  }
                  break;
                }
                case "text-end": {
                  const text = buffers.get(part.id)?.trim();
                  buffers.delete(part.id);
                  if (text) {
                    await recorder.recordItem({
                      kind: AgentRunItemKind.Text,
                      content: { text },
                    });
                  }
                  break;
                }
                case "tool-call":
                  toolCalls++;
                  await recorder.recordItem({
                    kind: AgentRunItemKind.ToolCall,
                    toolName: part.toolName,
                    toolCallId: part.toolCallId,
                    content: { input: part.input as unknown },
                  });
                  break;
                case "tool-result":
                  await recorder.recordItem({
                    kind: AgentRunItemKind.ToolResult,
                    toolName: part.toolName,
                    toolCallId: part.toolCallId,
                    content: { output: part.output as unknown },
                  });
                  break;
                case "tool-error":
                  await recorder.recordItem({
                    kind: AgentRunItemKind.ToolResult,
                    toolName: part.toolName,
                    toolCallId: part.toolCallId,
                    content: {
                      error:
                        part.error instanceof Error
                          ? part.error.message
                          : String(part.error),
                    },
                  });
                  break;
                case "finish-step":
                  recorder.advanceStep();
                  break;
                case "error":
                  throw part.error instanceof Error
                    ? part.error
                    : new Error(
                        typeof part.error === "string"
                          ? part.error
                          : JSON.stringify(part.error),
                      );
                default:
                  break;
              }
            }

            return toolCalls;
          };

          const usages: Array<{
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
          }> = [];

          // Provider capacity errors (529 Overloaded) arrive mid-stream and
          // bypass request-level retries — restart the pass with backoff.
          let stream: Awaited<ReturnType<typeof agent.stream>> | undefined;
          let toolCallsSeen = 0;
          for (let attempt = 0; ; attempt++) {
            try {
              stream = await agent.stream({
                prompt: dossier,
                ...callOptions,
              });
              toolCallsSeen = await consume(stream);
              usages.push(await stream.totalUsage);
              break;
            } catch (error) {
              const text =
                error instanceof Error ? error.message : JSON.stringify(error);
              const transient = /overloaded|529|rate.?limit/i.test(text);
              if (!transient || attempt >= 2) throw error;
              recorder.advanceStep();
              if (attempt === 1 && activeModel !== FALLBACK_MODEL) {
                // Two overloads in a row — the endpoint is saturated.
                activeModel = FALLBACK_MODEL;
                agent = buildAgent(activeModel);
                await recorder.recordItem({
                  kind: AgentRunItemKind.Text,
                  content: {
                    text: `[fallback] ${CLASSIFICATION_MODEL} is overloaded — continuing on ${FALLBACK_MODEL}`,
                  },
                });
              } else {
                await recorder.recordItem({
                  kind: AgentRunItemKind.Text,
                  content: {
                    text: `[retry] the model provider was overloaded — restarting the research pass (attempt ${attempt + 2})`,
                  },
                });
              }
              await new Promise((resolve) =>
                setTimeout(resolve, (attempt + 1) * 10_000),
              );
            }
          }
          if (!stream) throw new Error("agent stream never started");

          // Prompt-level mandates are not a guarantee — when the model
          // answers purely from memory, send it back to verify against the
          // live schedule and CROSS before the answer can count.
          if (toolCallsSeen === 0) {
            recorder.advanceStep();
            await recorder.recordItem({
              kind: AgentRunItemKind.Text,
              content: {
                text: "[verification] the run made no lookups — sending it back to verify against the live schedule and CROSS",
              },
            });

            const { messages } = await stream.response;
            stream = await agent.stream({
              messages: [
                { role: "user", content: dossier },
                ...messages,
                {
                  role: "user",
                  content:
                    "You answered without a single lookup — that does not meet the reasonable-care standard. Execute the verification checklist now: searchHts for your chosen and rejected headings, getChapterNotes for the governing notes, searchRulings (and getRuling) for real precedent, and browseHtsHeading to confirm the exact statistical line. Then re-emit the final answer with citations drawn only from these lookups.",
                },
              ],
              ...callOptions,
            });
            await consume(stream);
            usages.push(await stream.totalUsage);
          }

          let output = await stream.output;
          let usage = usages.reduce(
            (sum, entry) => ({
              inputTokens: (sum.inputTokens ?? 0) + (entry.inputTokens ?? 0),
              outputTokens: (sum.outputTokens ?? 0) + (entry.outputTokens ?? 0),
              totalTokens: (sum.totalTokens ?? 0) + (entry.totalTokens ?? 0),
            }),
            {} as {
              inputTokens?: number;
              outputTokens?: number;
              totalTokens?: number;
            },
          );

          // The model occasionally emits a placeholder answer. Give it one
          // repair turn — with its own research still in context — before
          // failing the run.
          if (!isValidHtsCode(output.htsCode)) {
            recorder.advanceStep();
            await recorder.recordItem({
              kind: AgentRunItemKind.Text,
              content: {
                text: `[repair] answer contained an invalid HTS code ("${output.htsCode}") — requesting the final classification`,
              },
            });

            const { messages } = await stream.response;
            const repair = await generateText({
              model: anthropic(activeModel),
              system: systemPrompt.text,
              messages: [
                { role: "user", content: dossier },
                ...messages,
                {
                  role: "user",
                  content:
                    "Your answer contained placeholder values. Emit the final classification object now, with real values only, based on the research above.",
                },
              ],
              output: Output.object({ schema: classificationResultSchema }),
              maxOutputTokens: 24_000,
              telemetry: { functionId: "hts-classification-repair" },
            });
            output = repair.output;
            usage = {
              ...usage,
              inputTokens:
                (usage.inputTokens ?? 0) + (repair.totalUsage.inputTokens ?? 0),
              outputTokens:
                (usage.outputTokens ?? 0) +
                (repair.totalUsage.outputTokens ?? 0),
              totalTokens:
                (usage.totalTokens ?? 0) + (repair.totalUsage.totalTokens ?? 0),
            };
          }

          if (!isValidHtsCode(output.htsCode)) {
            throw new Error(
              `Agent returned an invalid HTS code ("${output.htsCode}") even after a repair turn — rejecting the run`,
            );
          }

          return { output, usage };
        },
      );

      await recorder.complete({
        result: output as unknown as Record<string, unknown>,
        model: activeModel,
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        },
      });

      return { result: output, runId: recorder.runId };
    } catch (error) {
      await recorder.fail(error);
      throw error;
    }
  }
}
