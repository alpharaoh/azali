import { AgentRunItemKind, type SelectAgentRunItem } from "@/db/schema";
import type { ClassificationResult } from "./schema";

/* -------------------------------------------------------------------------------------------------
 * Presentation projection of the canonical agent-run record — the shapes the
 * review UI renders (TracePhase/TraceStep). The audit record in agent_runs /
 * agent_run_items is the source of truth; this only summarizes it.
 * -----------------------------------------------------------------------------------------------*/

export interface TraceStepView {
  kind: "calc" | "check" | "decision" | "flag" | "lookup" | "read";
  title: string;
  detail: string;
  data?: string[];
}

export interface TracePhaseView {
  label: string;
  steps: TraceStepView[];
}

const TOOL_STEP_KIND: Record<string, TraceStepView["kind"]> = {
  searchHts: "lookup",
  browseHtsHeading: "lookup",
  getChapterNotes: "read",
  searchRulings: "lookup",
  getRuling: "read",
  searchKnowledge: "lookup",
};

/** One compact evidence line per stored tool result. */
function summarizeResult(item: SelectAgentRunItem): string[] {
  const content = item.content as {
    output?: unknown;
    preview?: string;
    truncated?: boolean;
    error?: string;
  };
  if (content.error) return [`error: ${content.error.slice(0, 90)}`];
  if (content.truncated) return ["(large result — see audit record)"];

  const output = content.output;
  try {
    switch (item.toolName) {
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
      case "searchRulings": {
        const value = output as {
          totalHits: number;
          rulings: Array<{
            rulingNumber: string;
            subject: string;
            revoked: boolean;
          }>;
        };
        return [
          `${value.totalHits} hits`,
          ...value.rulings
            .slice(0, 3)
            .map(
              (ruling) =>
                `${ruling.rulingNumber} — ${ruling.subject.slice(0, 60)}${ruling.revoked ? " [REVOKED]" : ""}`,
            ),
        ];
      }
      case "getRuling": {
        const value = output as { rulingNumber: string; subject: string };
        return [`${value.rulingNumber} — ${value.subject.slice(0, 70)}`];
      }
      case "searchKnowledge":
        return (output as Array<{ text: string; score: number }>)
          .slice(0, 3)
          .map(
            (match) =>
              `${match.score.toFixed(2)} ${match.text.slice(0, 60).replace(/\n/g, " ")}`,
          );
      default:
        return [];
    }
  } catch {
    return [];
  }
}

export function toTracePhases(
  items: SelectAgentRunItem[],
  result: ClassificationResult,
): TracePhaseView[] {
  const phases: TracePhaseView[] = [];

  const stepIndexes = [...new Set(items.map((item) => item.stepIndex))].sort(
    (a, b) => a - b,
  );

  for (const stepIndex of stepIndexes) {
    const stepItems = items.filter((item) => item.stepIndex === stepIndex);
    const steps: TraceStepView[] = [];

    for (const item of stepItems) {
      if (item.kind === AgentRunItemKind.Reasoning) {
        const text = (item.content as { text?: string }).text ?? "";
        if (text.trim()) {
          steps.push({
            kind: "check",
            title: "Thinking",
            detail: text.slice(0, 240),
          });
        }
      }
      if (item.kind === AgentRunItemKind.ToolCall) {
        const paired = stepItems.find(
          (candidate) =>
            candidate.kind === AgentRunItemKind.ToolResult &&
            candidate.toolCallId === item.toolCallId,
        );
        steps.push({
          kind: TOOL_STEP_KIND[item.toolName ?? ""] ?? "check",
          title: item.toolName ?? "tool",
          detail: JSON.stringify((item.content as { input?: unknown }).input),
          data: paired ? summarizeResult(paired) : undefined,
        });
      }
    }

    if (steps.length > 0) {
      phases.push({ label: `Research — pass ${phases.length + 1}`, steps });
    }
  }

  phases.push({
    label: "Decision",
    steps: [
      {
        kind: "decision",
        title: `Classified ${result.htsCode}`,
        detail: result.summary,
        data: [
          `confidence ${result.confidence.toFixed(2)}`,
          `duty: ${result.dutyRate.effective}`,
        ],
      },
    ],
  });

  return phases;
}
