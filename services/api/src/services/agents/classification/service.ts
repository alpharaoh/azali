import { propagateAttributes } from "@langfuse/tracing";
import { Output, stepCountIs, ToolLoopAgent } from "ai";
import type { DocumentExtraction, ShipmentDocumentCategory } from "@/db/schema";
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

const CLASSIFICATION_MODEL = "claude-sonnet-4-6";
const MAX_STEPS = 24;
const THINKING_BUDGET_TOKENS = 8_000;

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
    const agent = new ToolLoopAgent({
      model: anthropic(CLASSIFICATION_MODEL),
      instructions: systemPrompt.text,
      tools: {
        ...htsTools,
        ...crossRulingsTools,
        ...createKnowledgeBaseTools(organizationId),
      },
      stopWhen: stepCountIs(MAX_STEPS),
      output: Output.object({ schema: classificationResultSchema }),
      providerOptions: {
        anthropic: {
          thinking: { type: "enabled", budgetTokens: THINKING_BUDGET_TOKENS },
        },
      },
    });

    try {
      const { output, totalUsage } = await propagateAttributes(
        {
          traceName: "hts-classification",
          userId,
          sessionId: shipment.id,
          tags: ["classification"],
          metadata: { organizationId, reference: shipment.reference },
        },
        () =>
          agent.generate({
            prompt: dossier,
            // Persist each loop step as it completes — a crashed run still
            // leaves its audit trail.
            onStepFinish: (step) => recorder.recordStep(step),
            ...(systemPrompt.prompt
              ? { runtimeContext: { langfusePrompt: systemPrompt.prompt } }
              : {}),
            telemetry: {
              functionId: "hts-classification",
              ...(systemPrompt.prompt
                ? { includeRuntimeContext: { langfusePrompt: true } }
                : {}),
            },
          }),
      );

      // A placeholder is not a classification — fail loudly so the step
      // retries instead of a non-answer flowing into the shipment record.
      if (!/^\d{4}\.\d{2}\.\d{2,4}/.test(output.htsCode)) {
        throw new Error(
          `Agent returned an invalid HTS code ("${output.htsCode}") — rejecting the run`,
        );
      }

      await recorder.complete({
        result: output as unknown as Record<string, unknown>,
        usage: {
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
          totalTokens: totalUsage.totalTokens,
        },
      });

      return { result: output, runId: recorder.runId };
    } catch (error) {
      await recorder.fail(error);
      throw error;
    }
  }
}
