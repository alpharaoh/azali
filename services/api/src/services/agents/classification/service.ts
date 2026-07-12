import { propagateAttributes } from "@langfuse/tracing";
import { generateText, Output, stepCountIs } from "ai";
import type { DocumentExtraction, ShipmentDocumentCategory } from "@/db/schema";
import { anthropic } from "@/services/external/anthropic/client";
import { crossRulingsTools } from "@/services/external/cross/tools";
import { createKnowledgeBaseTools } from "@/services/external/pinecone/tools";
import { htsTools } from "@/services/external/usitc/tools";
import { CLASSIFICATION_SYSTEM_PROMPT } from "./prompt";
import {
  type ClassificationResult,
  classificationResultSchema,
} from "./schema";

const CLASSIFICATION_MODEL = "claude-sonnet-4-6";
const MAX_STEPS = 24;

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

/** The trace shape the review UI renders (TracePhase/TraceStep). */
export interface AgentTraceStep {
  kind: "calc" | "check" | "decision" | "flag" | "lookup" | "read";
  title: string;
  detail: string;
  data?: string[];
}

export interface AgentTracePhase {
  label: string;
  steps: AgentTraceStep[];
}

export interface ClassificationOutcome {
  result: ClassificationResult;
  trace: AgentTracePhase[];
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

const TOOL_STEP_KIND: Record<string, AgentTraceStep["kind"]> = {
  searchHts: "lookup",
  browseHtsHeading: "lookup",
  getChapterNotes: "read",
  searchRulings: "lookup",
  getRuling: "read",
  searchKnowledge: "lookup",
};

/** One compact evidence line per tool result, for the trace UI. */
// Tool outputs are summarized dynamically — shapes vary per tool.
function summarizeToolResult(toolName: string, output: any): string[] {
  try {
    switch (toolName) {
      case "searchHts":
      case "browseHtsHeading":
        return (
          output as Array<{
            htsNumber: string;
            description: string;
            general: string;
          }>
        )
          .filter((line) => line.htsNumber)
          .slice(0, 4)
          .map(
            (line) =>
              `${line.htsNumber} — ${line.description.slice(0, 60)}${line.general ? ` (${line.general})` : ""}`,
          );
      case "getChapterNotes":
        return [`${String(output).slice(0, 90).replace(/\n/g, " ")}…`];
      case "searchRulings":
        return [
          `${output.totalHits} hits`,
          ...output.rulings
            .slice(0, 3)
            .map(
              (r: {
                rulingNumber: string;
                subject: string;
                revoked: boolean;
              }) =>
                `${r.rulingNumber} — ${r.subject.slice(0, 60)}${r.revoked ? " [REVOKED]" : ""}`,
            ),
        ];
      case "getRuling":
        return [`${output.rulingNumber} — ${output.subject.slice(0, 70)}`];
      case "searchKnowledge":
        return (output as Array<{ text: string; score: number }>)
          .slice(0, 3)
          .map(
            (m) =>
              `${m.score.toFixed(2)} ${m.text.slice(0, 60).replace(/\n/g, " ")}`,
          );
      default:
        return [];
    }
  } catch {
    return [];
  }
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
    const { output, steps } = await propagateAttributes(
      {
        traceName: "hts-classification",
        userId,
        sessionId: shipment.id,
        tags: ["classification"],
        metadata: { organizationId, reference: shipment.reference },
      },
      () =>
        generateText({
          model: anthropic(CLASSIFICATION_MODEL),
          system: CLASSIFICATION_SYSTEM_PROMPT,
          prompt: buildDossier(shipment, documents),
          tools: {
            ...htsTools,
            ...crossRulingsTools,
            ...createKnowledgeBaseTools(organizationId),
          },
          stopWhen: stepCountIs(MAX_STEPS),
          output: Output.object({ schema: classificationResultSchema }),
          telemetry: { functionId: "hts-classification" },
        }),
    );

    // Map the tool-call history into the trace shape the review UI renders.
    const trace: AgentTracePhase[] = [];
    for (const step of steps) {
      const stepEntries: AgentTraceStep[] = step.toolCalls.map((call) => {
        const result = step.toolResults.find(
          (toolResult) => toolResult.toolCallId === call.toolCallId,
        );
        return {
          kind: TOOL_STEP_KIND[call.toolName] ?? "check",
          title: call.toolName,
          detail: JSON.stringify(call.input),
          data: result
            ? summarizeToolResult(call.toolName, result.output)
            : undefined,
        };
      });
      if (stepEntries.length > 0) {
        trace.push({
          label: `Research — pass ${trace.length + 1}`,
          steps: stepEntries,
        });
      }
    }
    trace.push({
      label: "Decision",
      steps: [
        {
          kind: "decision",
          title: `Classified ${output.htsCode}`,
          detail: output.summary,
          data: [
            `confidence ${output.confidence.toFixed(2)}`,
            `duty: ${output.dutyRate.effective}`,
          ],
        },
      ],
    });

    return { result: output, trace };
  }
}
