import { propagateAttributes } from "@langfuse/tracing";
import {
  generateText,
  hasToolCall,
  stepCountIs,
  ToolLoopAgent,
  tool,
} from "ai";
import { getOrganizationSlug } from "@/db/lib/getOrganizationSlug";
import { AgentRunItemKind } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import { anthropic } from "@/services/external/anthropic/client";
import { resolvePrompt } from "@/services/external/langfuse/prompts";
import { createKnowledgeBaseTools } from "@/services/external/pinecone/tools";
import { htsTools } from "@/services/external/usitc/tools";
import type { PgaFlagMatch } from "@/services/pga/flagLookup";
import { pgaTools } from "@/services/pga/tools";
import type {
  ClassificationDocument,
  ClassificationShipmentFacts,
} from "../classification/service";
import { AgentRunRecorder } from "../recorder";
import {
  PGA_FLAG_REFERENCE,
  PGA_PROMPT_NAME,
  PGA_SYSTEM_PROMPT,
} from "./prompt";
import {
  type PgaScreeningResult,
  pgaCalibrationViolations,
  pgaScreeningResultSchema,
} from "./schema";

const PGA_MODEL = "claude-opus-4-8";
/** Used when the primary model's endpoint is overloaded. */
const FALLBACK_MODEL = "claude-sonnet-4-6";
/** Screening is narrower than classification — flags are pre-resolved. */
const MAX_STEPS = 30;

const log = createLogger("pga-agent");

/** The classified line being screened — classification is already frozen. */
export interface PgaLineItem {
  id: string;
  lineNumber: number;
  description: string;
  sku: string | null;
  quantity: number | null;
  unit: string | null;
  totalValueCents: number | null;
  originCountry: string | null;
  htsCode: string;
  htsDescription: string | null;
  classificationSummary: string | null;
  /** Accumulated classification-relevant product facts (products.attributes). */
  productAttributes: Record<string, unknown> | null;
}

export interface PgaScreeningOutcome {
  result: PgaScreeningResult;
  /** The canonical audit record (agent_runs.id); null if recording failed. */
  runId: string | null;
}

/** The flag lookup as it travels between Inngest steps — JSON-serializable
 * (publishedAt is an ISO date string, not a Date). */
export interface PgaFlagLookupSnapshot {
  version: {
    id: string;
    pubNumber: string;
    publishedAt: string;
    source: string;
  };
  flags: PgaFlagMatch[];
}

function formatFlagLookup(lookup: PgaFlagLookupSnapshot): string {
  const header = `ACE Agency Tariff Code Reference ${lookup.version.pubNumber} (published ${lookup.version.publishedAt.slice(0, 10)}) — cite this as flagTableVersion.`;
  if (lookup.flags.length === 0) {
    return `${header}\nNo PGA flags on this HTS code in the active publication. Flags lag HTS revisions — your jurisdiction sweep is the only screen this line gets.`;
  }
  const rows = lookup.flags.map(
    (flag) =>
      `- ${flag.flagCode} (${flag.agencyCode}, ${
        flag.requirement === "required" ? "REQUIRED" : "MAY be required"
      }, matched at prefix ${flag.matchedPrefix})${flag.programDescription ? `: ${flag.programDescription}` : ""}`,
  );
  return [header, ...rows].join("\n");
}

function buildDossier(
  shipment: ClassificationShipmentFacts,
  lineItem: PgaLineItem,
  documents: ClassificationDocument[],
  flagLookup: PgaFlagLookupSnapshot,
  triageNote: string | null,
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
    `- Classified HTS code: ${lineItem.htsCode}${lineItem.htsDescription ? ` — ${lineItem.htsDescription}` : ""}`,
    lineItem.classificationSummary
      ? `- Classification rationale: ${lineItem.classificationSummary}`
      : null,
  ].filter(Boolean) as string[];

  const attributes = lineItem.productAttributes
    ? Object.entries(lineItem.productAttributes)
        .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
        .join("\n")
    : null;

  return [
    `## The line to screen — line ${lineItem.lineNumber} of shipment ${shipment.reference}`,
    ...lineFacts,
    "",
    "## PGA flag lookup (deterministic, already run for this code)",
    formatFlagLookup(flagLookup),
    ...(triageNote ? ["", "## Jurisdiction triage note", triageNote] : []),
    "",
    "## Shipment context",
    `- Importer: ${shipment.clientName ?? "unknown"}`,
    `- Shipment origin: ${shipment.originCountry}`,
    `- Shipment value: $${(shipment.valueCents / 100).toLocaleString("en-US")}`,
    ...(attributes
      ? ["", "## Known product attributes (accumulated)", attributes]
      : []),
    "",
    "## Source documents (extracted)",
    ...sections,
    "",
    "Screen THIS LINE ONLY. Disposition every flag above (required / disclaim with code / not_applicable), run the jurisdiction sweep beyond the flags, check required data elements against the documents, and cite the flag-table publication. Start with your first verification lookup now.",
  ].join("\n");
}

export class PgaAgentService {
  static async screen({
    organizationId,
    userId,
    shipment,
    lineItem,
    documents,
    flagLookup,
    triageNote = null,
  }: {
    organizationId: string;
    userId: string;
    shipment: ClassificationShipmentFacts;
    lineItem: PgaLineItem;
    documents: ClassificationDocument[];
    flagLookup: PgaFlagLookupSnapshot;
    /** Jurisdiction suspicions from the no-flag triage pass, when it ran. */
    triageNote?: string | null;
  }): Promise<PgaScreeningOutcome> {
    const systemPrompt = await resolvePrompt(
      PGA_PROMPT_NAME,
      PGA_SYSTEM_PROMPT,
      { flagReference: PGA_FLAG_REFERENCE },
    );
    const organizationSlug = await getOrganizationSlug(organizationId);
    const dossier = buildDossier(
      shipment,
      lineItem,
      documents,
      flagLookup,
      triageNote,
    );
    const lookedUpFlags: PgaFlagMatch[] = flagLookup.flags;

    const recorder = await AgentRunRecorder.start({
      organizationId,
      userId,
      shipmentId: shipment.id,
      agent: "pga_screening",
      model: PGA_MODEL,
      promptName: systemPrompt.prompt ? PGA_PROMPT_NAME : null,
      promptVersion: systemPrompt.prompt?.version ?? null,
      input: {
        dossier,
        reference: shipment.reference,
        lineItem: {
          id: lineItem.id,
          lineNumber: lineItem.lineNumber,
          description: lineItem.description,
          htsCode: lineItem.htsCode,
        },
        flagTable: {
          pubNumber: flagLookup.version.pubNumber,
          flags: lookedUpFlags.map((flag) => flag.flagCode),
        },
        documents: documents.map((document) => ({
          fileName: document.fileName,
          category: document.category,
        })),
      },
    });

    // Same architecture as classification: the final answer is a TOOL CALL —
    // the text channel stays free for narration, and the answer ends the run.
    const submitPgaScreening = tool({
      description:
        "Submit your final PGA screening. Calling this ends the run immediately — call it exactly once, when every flag is dispositioned and the jurisdiction sweep is complete, with real values throughout.",
      inputSchema: pgaScreeningResultSchema,
      execute: async () => ({ recorded: true }),
    });

    const buildAgent = (model: string) =>
      new ToolLoopAgent({
        model: anthropic(model),
        instructions: systemPrompt.text,
        tools: {
          ...pgaTools,
          ...htsTools,
          ...createKnowledgeBaseTools(organizationId, shipment.clientId),
          // Provider-executed on Anthropic's side — results carry real URLs.
          webSearch: anthropic.tools.webSearch_20260209({ maxUses: 6 }),
          submitPgaScreening,
        },
        stopWhen: [stepCountIs(MAX_STEPS), hasToolCall("submitPgaScreening")],
        maxOutputTokens: 24_000,
        providerOptions: {
          anthropic: {
            thinking: model.includes("opus")
              ? { type: "adaptive", display: "summarized" }
              : { type: "enabled", budgetTokens: 8_000 },
          },
        },
      });

    let activeModel = PGA_MODEL;
    let agent = buildAgent(activeModel);

    log.info(
      {
        runId: recorder.runId,
        shipmentId: shipment.id,
        reference: shipment.reference,
        lineNumber: lineItem.lineNumber,
        htsCode: lineItem.htsCode,
        flagCount: lookedUpFlags.length,
        promptVersion: systemPrompt.prompt?.version ?? null,
      },
      "pga screening run starting",
    );

    try {
      const { output, usage } = await propagateAttributes(
        {
          traceName: "pga-screening",
          userId,
          sessionId: shipment.id,
          tags: ["pga"],
          metadata: {
            organizationId,
            organizationSlug,
            reference: shipment.reference,
            lineNumber: String(lineItem.lineNumber),
          },
        },
        async () => {
          const callOptions = {
            timeout: { totalMs: 900_000, stepMs: 420_000 },
            ...(systemPrompt.prompt
              ? { runtimeContext: { langfusePrompt: systemPrompt.prompt } }
              : {}),
            telemetry: {
              functionId: "pga-screening",
              ...(systemPrompt.prompt
                ? { includeRuntimeContext: { langfusePrompt: true } }
                : {}),
            },
          };

          let submitted: PgaScreeningResult | null = null;

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
                  if (part.toolName === "submitPgaScreening") {
                    const parsed = pgaScreeningResultSchema.safeParse(
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
              usages.push(await stream.usage);
              break;
            } catch (error) {
              const text =
                error instanceof Error ? error.message : JSON.stringify(error);
              const transient = /overloaded|529|rate.?limit/i.test(text);
              if (!transient || attempt >= 2) throw error;
              recorder.advanceStep();
              if (attempt === 1 && activeModel !== FALLBACK_MODEL) {
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
                  "provider overloaded — retrying the screening pass",
                );
                await recorder.recordItem({
                  kind: AgentRunItemKind.Text,
                  content: {
                    text: `[retry] the model provider was overloaded — restarting the screening pass (attempt ${attempt + 2})`,
                  },
                });
              }
              await new Promise((resolve) =>
                setTimeout(resolve, (attempt + 1) * 10_000),
              );
            }
          }
          if (!stream) throw new Error("agent stream never started");

          // A screening with flags in play must verify — when the model
          // answers purely from the dossier without a single lookup, send it
          // back to check agency guidance before the answer can count.
          if (toolCallsSeen === 0 && lookedUpFlags.length > 0) {
            log.warn(
              { runId: recorder.runId, shipmentId: shipment.id },
              "screening made no lookups — forcing a verification turn",
            );
            recorder.advanceStep();
            await recorder.recordItem({
              kind: AgentRunItemKind.Text,
              content: {
                text: "[verification] the run made no lookups — sending it back to verify agency scope before the screening can count",
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
                    "You screened flagged agencies without a single verification lookup — that does not meet the reasonable-care standard. Verify now: check the brokerage's verified record with searchPriorClassifications for how this product was screened before, and confirm the scope of each flagged agency's requirements with webSearch against agency guidance. Then call submitPgaScreening with citations drawn from these lookups.",
                },
              ],
              ...callOptions,
            });
            await consume(stream);
            usages.push(await stream.usage);
          }

          // The cast resets control-flow narrowing: `submitted` is assigned
          // inside the stream consumer, which tsc's linear analysis misses.
          let output = submitted as PgaScreeningResult | null;
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

          // No valid submission, or one that breaks the rubric's hard rules
          // (dropped flags, disclaims without codes) — one repair turn with
          // forced tool choice.
          const violations = output
            ? pgaCalibrationViolations(output, lookedUpFlags)
            : [];
          if (!output || violations.length) {
            log.warn(
              {
                runId: recorder.runId,
                calibrationViolations: violations,
              },
              "no rubric-consistent screening from the loop — running a repair turn",
            );
            recorder.advanceStep();
            await recorder.recordItem({
              kind: AgentRunItemKind.Text,
              content: {
                text: output
                  ? `[repair] the screening violates the calibration rubric — requesting a corrected submission:\n- ${violations.join("\n- ")}`
                  : "[repair] the run ended without a submitted screening — requesting the submission",
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
                    ? `Your screening violates the calibration rubric:\n- ${violations.join(
                        "\n- ",
                      )}\n\nCall submitPgaScreening again with a corrected, rubric-consistent answer based on the research above. Fix the accounting — do not change the determinations themselves unless a violation genuinely requires it.`
                    : "Call submitPgaScreening now with your complete final answer — every flag dispositioned, real values throughout, based on the research above.",
                },
              ],
              tools: { submitPgaScreening },
              toolChoice: {
                type: "tool",
                toolName: "submitPgaScreening",
              },
              providerOptions: {
                // Forced tool choice is incompatible with thinking.
                anthropic: { thinking: { type: "disabled" } },
              },
              maxOutputTokens: 24_000,
              telemetry: { functionId: "pga-screening-repair" },
            });

            const call = repair.toolCalls.find(
              (candidate) => candidate.toolName === "submitPgaScreening",
            );
            const parsed = pgaScreeningResultSchema.safeParse(call?.input);
            output = parsed.success ? parsed.data : null;
            if (output) {
              await recorder.recordItem({
                kind: AgentRunItemKind.ToolCall,
                toolName: "submitPgaScreening",
                toolCallId: call?.toolCallId,
                content: { input: output },
              });
            }
            usage = {
              ...usage,
              inputTokens:
                (usage.inputTokens ?? 0) + (repair.usage.inputTokens ?? 0),
              outputTokens:
                (usage.outputTokens ?? 0) + (repair.usage.outputTokens ?? 0),
              totalTokens:
                (usage.totalTokens ?? 0) + (repair.usage.totalTokens ?? 0),
            };
          }

          if (!output) {
            throw new Error(
              "Agent did not produce a valid PGA screening even after a repair turn — rejecting the run",
            );
          }

          // A repair turn that still breaks the rubric is not fatal — the
          // screening stands, but the miscalibration goes on the audit
          // record for the broker.
          const residual = pgaCalibrationViolations(output, lookedUpFlags);
          if (residual.length) {
            log.warn(
              { runId: recorder.runId, calibrationViolations: residual },
              "screening retains calibration violations after the repair turn",
            );
            await recorder.recordItem({
              kind: AgentRunItemKind.Text,
              content: {
                text: `[calibration] the final screening still violates the rubric — flagged for broker attention:\n- ${residual.join("\n- ")}`,
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
          determinations: output.determinations.map(
            (determination) =>
              `${determination.agencyCode}:${determination.determination}`,
          ),
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        },
        "pga screening run completed",
      );

      return { result: output, runId: recorder.runId };
    } catch (error) {
      log.error(
        { err: error, runId: recorder.runId, shipmentId: shipment.id },
        "pga screening run failed",
      );
      await recorder.fail(error);
      throw error;
    }
  }
}
