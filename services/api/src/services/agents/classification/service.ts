import { propagateAttributes } from "@langfuse/tracing";
import {
  generateText,
  hasToolCall,
  stepCountIs,
  ToolLoopAgent,
  tool,
} from "ai";
import { getOrganizationSlug } from "@/db/lib/getOrganizationSlug";
import type { DocumentExtraction, ShipmentDocumentCategory } from "@/db/schema";
import { AgentRunItemKind } from "@/db/schema";
import { createLogger } from "@/lib/logger";
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
  calibrationViolations,
  classificationResultSchema,
} from "./schema";

const CLASSIFICATION_MODEL = "claude-opus-4-8";
/** Used when the primary model's endpoint is overloaded. */
const FALLBACK_MODEL = "claude-sonnet-4-6";
/** Sized for the Tier-3 research ladder (~35 tool calls, batched). */
const MAX_STEPS = 40;
const isValidHtsCode = (code: string) => /^\d{4}\.\d{2}\.\d{2,4}/.test(code);

const log = createLogger("classification-agent");

export interface ClassificationShipmentFacts {
  id: string;
  reference: string;
  clientId: string;
  clientName: string | null;
  originCountry: string;
  valueCents: number;
}

export interface ClassificationDocument {
  fileName: string;
  category: ShipmentDocumentCategory;
  extraction: DocumentExtraction;
}

/** The product being classified — one line item of the shipment. */
export interface ClassificationLineItem {
  id: string;
  lineNumber: number;
  description: string;
  sku: string | null;
  quantity: number | null;
  unit: string | null;
  totalValueCents: number | null;
  originCountry: string | null;
  declaredHts: string | null;
}

export interface ClassificationOutcome {
  result: ClassificationResult;
  /** The canonical audit record (agent_runs.id); null if recording failed. */
  runId: string | null;
}

function buildDossier(
  shipment: ClassificationShipmentFacts,
  lineItem: ClassificationLineItem,
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

  const lineFacts = [
    `- Description: ${lineItem.description}`,
    lineItem.sku ? `- SKU / part number: ${lineItem.sku}` : null,
    lineItem.quantity !== null
      ? `- Quantity: ${lineItem.quantity}${lineItem.unit ? ` ${lineItem.unit}` : ""}`
      : null,
    lineItem.totalValueCents !== null
      ? `- Line value: $${(lineItem.totalValueCents / 100).toLocaleString("en-US")}`
      : null,
    `- Country of origin: ${lineItem.originCountry ?? shipment.originCountry}`,
    lineItem.declaredHts
      ? `- Supplier-declared code (a hypothesis to verify): ${lineItem.declaredHts}`
      : null,
  ].filter(Boolean) as string[];

  return [
    `## The product to classify — line ${lineItem.lineNumber} of shipment ${shipment.reference}`,
    ...lineFacts,
    "",
    "## Shipment context",
    `- Importer: ${shipment.clientName ?? "unknown"}`,
    `- Shipment origin: ${shipment.originCountry}`,
    `- Shipment value: $${(shipment.valueCents / 100).toLocaleString("en-US")}`,
    "",
    "## Source documents (extracted)",
    ...sections,
    "",
    "Classify THIS PRODUCT ONLY — the line described above. The documents may mention other line items; use them solely as context for this product. Any HS/HTS code appearing in the documents is a supplier hypothesis to verify, not ground truth.",
    "",
    "Before you answer: verify candidate headings with searchHts, read the governing notes with getChapterNotes, check precedent with searchRulings (and read the strongest hits with getRuling), and confirm the exact statistical line with browseHtsHeading. Your citations must come from lookups made in this run — start with your first tool call now.",
  ].join("\n");
}

export class ClassificationAgentService {
  static async classify({
    organizationId,
    userId,
    shipment,
    lineItem,
    documents,
  }: {
    organizationId: string;
    userId: string;
    shipment: ClassificationShipmentFacts;
    lineItem: ClassificationLineItem;
    documents: ClassificationDocument[];
  }): Promise<ClassificationOutcome> {
    const systemPrompt = await resolvePrompt(
      CLASSIFICATION_PROMPT_NAME,
      CLASSIFICATION_SYSTEM_PROMPT,
    );
    const organizationSlug = await getOrganizationSlug(organizationId);
    const dossier = buildDossier(shipment, lineItem, documents);

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
        lineItem: {
          id: lineItem.id,
          lineNumber: lineItem.lineNumber,
          description: lineItem.description,
          sku: lineItem.sku,
        },
        documents: documents.map((document) => ({
          fileName: document.fileName,
          category: document.category,
        })),
      },
    });

    // The final answer is a TOOL CALL, not constrained output — leaving the
    // model's text channel free for narration, and making "the answer ends
    // the run" literal (stopWhen below). Structured output would force every
    // text emission into the schema, which is where placeholder answers
    // came from.
    const submitClassification = tool({
      description:
        "Submit your final classification. Calling this ends the run immediately — call it exactly once, when your research is complete, with real values throughout.",
      inputSchema: classificationResultSchema,
      execute: async () => ({ recorded: true }),
    });

    // The agent loop: think → call tools → observe → repeat, until the
    // evidence converges and the classification is submitted.
    const buildAgent = (model: string) =>
      new ToolLoopAgent({
        model: anthropic(model),
        instructions: systemPrompt.text,
        tools: {
          ...htsTools,
          ...crossRulingsTools,
          ...createKnowledgeBaseTools(organizationId, shipment.clientId),
          // Provider-executed on Anthropic's side — results carry real URLs.
          webSearch: anthropic.tools.webSearch_20260209({ maxUses: 6 }),
          submitClassification,
        },
        stopWhen: [stepCountIs(MAX_STEPS), hasToolCall("submitClassification")],
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

    log.info(
      {
        runId: recorder.runId,
        shipmentId: shipment.id,
        reference: shipment.reference,
        lineNumber: lineItem.lineNumber,
        lineDescription: lineItem.description.slice(0, 80),
        documentCount: documents.length,
        promptVersion: systemPrompt.prompt?.version ?? null,
      },
      "agent run starting",
    );

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
            lineNumber: String(lineItem.lineNumber),
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

          // The answer captured from the submitClassification call.
          let submitted: ClassificationResult | null = null;

          // Stream the loop so every unit of work is auditable the moment it
          // happens — reasoning, tool calls, and results land in the run
          // record live. Returns how many RESEARCH tool calls the pass made.
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
                  if (part.toolName === "submitClassification") {
                    const parsed = classificationResultSchema.safeParse(
                      part.input,
                    );
                    if (parsed.success) submitted = parsed.data;
                  } else {
                    toolCalls++;
                  }
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
                log.warn(
                  { runId: recorder.runId, attempt: attempt + 1 },
                  "provider overloaded twice — switching to the fallback model",
                );
                await recorder.recordItem({
                  kind: AgentRunItemKind.Text,
                  content: {
                    text: "[fallback] the primary model is overloaded — continuing on a fallback model",
                  },
                });
              } else {
                log.warn(
                  { runId: recorder.runId, attempt: attempt + 1 },
                  "provider overloaded — retrying the research pass",
                );
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
            log.warn(
              { runId: recorder.runId, shipmentId: shipment.id },
              "run made no lookups — forcing a verification turn",
            );
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
                    "You answered without a single lookup — that does not meet the reasonable-care standard. Execute the verification checklist now: searchHts for your chosen and rejected headings, getChapterNotes for the governing notes, searchRulings (and getRuling) for real precedent, and browseHtsHeading to confirm the exact statistical line. Then call submitClassification with citations drawn only from these lookups.",
                },
              ],
              ...callOptions,
            });
            await consume(stream);
            usages.push(await stream.totalUsage);
          }

          let output: ClassificationResult | null = submitted;
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

          // If the loop ended without a valid submission — or with one that
          // breaks the calibration rubric's hard rules — give the model one
          // repair turn: its research is still in context, and the forced
          // tool choice guarantees a structured submission this time.
          const violations = output ? calibrationViolations(output) : [];
          if (!output || !isValidHtsCode(output.htsCode) || violations.length) {
            log.warn(
              {
                runId: recorder.runId,
                htsCode: output?.htsCode ?? null,
                calibrationViolations: violations,
              },
              "no rubric-consistent submission from the loop — running a repair turn",
            );
            recorder.advanceStep();
            await recorder.recordItem({
              kind: AgentRunItemKind.Text,
              content: {
                text: output
                  ? violations.length
                    ? `[repair] the submission violates the calibration rubric — requesting a corrected submission:\n- ${violations.join("\n- ")}`
                    : `[repair] the submitted answer had an invalid HTS code ("${output.htsCode}") — requesting a corrected submission`
                  : "[repair] the run ended without a submitted classification — requesting the submission",
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
                  content: violations.length
                    ? `Your submission violates the calibration rubric:\n- ${violations.join(
                        "\n- ",
                      )}\n\nCall submitClassification again with a corrected, rubric-consistent answer based on the research above. Fix the calibration accounting — do not change the classification itself unless a violation genuinely requires it.`
                    : "Call submitClassification now with your complete final answer — real values throughout, based on the research above.",
                },
              ],
              tools: { submitClassification },
              toolChoice: {
                type: "tool",
                toolName: "submitClassification",
              },
              providerOptions: {
                // Forced tool choice is incompatible with thinking.
                anthropic: { thinking: { type: "disabled" } },
              },
              maxOutputTokens: 24_000,
              telemetry: { functionId: "hts-classification-repair" },
            });

            const call = repair.toolCalls.find(
              (candidate) => candidate.toolName === "submitClassification",
            );
            const parsed = classificationResultSchema.safeParse(call?.input);
            output = parsed.success ? parsed.data : null;
            if (output) {
              await recorder.recordItem({
                kind: AgentRunItemKind.ToolCall,
                toolName: "submitClassification",
                toolCallId: call?.toolCallId,
                content: { input: output },
              });
            }
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

          if (!output || !isValidHtsCode(output.htsCode)) {
            throw new Error(
              "Agent did not produce a valid classification even after a repair turn — rejecting the run",
            );
          }

          // A repair turn that still breaks the rubric is not fatal — the
          // classification stands, but the miscalibration goes on the audit
          // record for the broker.
          const residual = calibrationViolations(output);
          if (residual.length) {
            log.warn(
              { runId: recorder.runId, calibrationViolations: residual },
              "submission retains calibration violations after the repair turn",
            );
            await recorder.recordItem({
              kind: AgentRunItemKind.Text,
              content: {
                text: `[calibration] the final submission still violates the rubric — flagged for broker attention:\n- ${residual.join("\n- ")}`,
              },
            });
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

      log.info(
        {
          runId: recorder.runId,
          shipmentId: shipment.id,
          htsCode: output.htsCode,
          confidence: output.confidence,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        },
        "agent run completed",
      );

      return { result: output, runId: recorder.runId };
    } catch (error) {
      log.error(
        { err: error, runId: recorder.runId, shipmentId: shipment.id },
        "agent run failed",
      );
      await recorder.fail(error);
      throw error;
    }
  }
}
