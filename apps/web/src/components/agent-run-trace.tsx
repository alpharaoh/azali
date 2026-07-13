import {
  Book,
  CircleExclamation,
  FileText,
  Magnifier,
  Sparkles,
} from "@gravity-ui/icons";
import { Chip, Skeleton } from "@heroui/react";
import { ChainOfThought } from "@heroui-pro/react";
import type { ComponentType, SVGProps } from "react";
import type { AgentRunDetailResponseDtoItemsItem as RunItem } from "@/generated/api";
import { useAgentRunsControllerFind } from "@/generated/api";
import { ClampedText } from "./clamped-text";

/* -------------------------------------------------------------------------------------------------
 * The agent trace, rendered directly from the canonical audit record
 * (agent_runs / agent_run_items) — reasoning passages, every research action
 * with its findings, and the drafted answer, in the exact order they happened.
 * -----------------------------------------------------------------------------------------------*/

const TOOL_META: Record<
  string,
  { label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  searchHts: { label: "Searched the tariff schedule", icon: Magnifier },
  browseHtsHeading: { label: "Browsed a tariff heading", icon: Book },
  getChapterNotes: { label: "Read the chapter notes", icon: Book },
  searchRulings: { label: "Searched customs rulings", icon: Magnifier },
  getRuling: { label: "Read a ruling", icon: FileText },
  searchKnowledge: { label: "Searched the importer's record", icon: Magnifier },
};

/** "{"query":"wifi router"}" → wifi router · Chapter 85 · … */
function summarizeInput(content: Record<string, unknown>): string {
  const input = content.input;
  if (!input || typeof input !== "object") return "";
  return Object.values(input as Record<string, unknown>)
    .filter((value) => value !== undefined && value !== null)
    .map(String)
    .join(" · ");
}

/** Compact evidence lines from a stored tool result. */
function summarizeResult(item: RunItem): string[] {
  const content = item.content as {
    output?: unknown;
    preview?: string;
    truncated?: boolean;
    error?: string;
  };
  if (content.error) return [`error: ${content.error.slice(0, 110)}`];
  if (content.truncated) return ["(large result — clamped in the record)"];

  const output = content.output;
  try {
    switch (item.toolName) {
      case "searchHts":
      case "browseHtsHeading": {
        const lines = (
          output as Array<{
            htsNumber: string;
            description: string;
            general: string;
          }>
        ).filter((line) => line.htsNumber);
        return [
          ...lines
            .slice(0, 5)
            .map(
              (line) =>
                `${line.htsNumber}  ${line.description.slice(0, 64)}${line.general ? `  (${line.general})` : ""}`,
            ),
          ...(lines.length > 5 ? [`… ${lines.length - 5} more lines`] : []),
        ];
      }
      case "getChapterNotes":
        return [`${String(output).slice(0, 110).replace(/\n/g, " ")}…`];
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
            .slice(0, 4)
            .map(
              (ruling) =>
                `${ruling.rulingNumber}  ${ruling.subject.slice(0, 64)}${ruling.revoked ? "  [REVOKED]" : ""}`,
            ),
        ];
      }
      case "getRuling": {
        const value = output as { rulingNumber: string; subject: string };
        return [`${value.rulingNumber}  ${value.subject.slice(0, 80)}`];
      }
      case "searchKnowledge":
        return (output as Array<{ text: string; score: number }>)
          .slice(0, 3)
          .map(
            (match) =>
              `${match.score.toFixed(2)}  ${match.text.slice(0, 70).replace(/\n/g, " ")}`,
          );
      default:
        return [JSON.stringify(output).slice(0, 110)];
    }
  } catch {
    return [];
  }
}

/** The final answer text item is the structured output as JSON. */
function parseAnswer(text: string): {
  htsCode: string;
  confidence?: number;
  summary?: string;
  duty?: string;
} | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const value = JSON.parse(trimmed) as {
      htsCode?: string;
      confidence?: number;
      summary?: string;
      dutyRate?: { effective?: string };
    };
    if (typeof value.htsCode !== "string") return null;
    return {
      htsCode: value.htsCode,
      confidence: value.confidence,
      summary: value.summary,
      duty: value.dutyRate?.effective,
    };
  } catch {
    return null;
  }
}

function formatDuration(durationMs: number | null): string {
  if (!durationMs) return "a moment";
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 90) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m ${seconds % 60}s`;
}

export function AgentRunTrace({ runId }: { runId: string }) {
  const { data, isLoading } = useAgentRunsControllerFind(runId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 flex-1 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  const run = data?.data.run;
  const items = data?.data.items ?? [];
  if (!run) {
    return (
      <span className="text-muted text-sm">
        The audit record for this run is unavailable.
      </span>
    );
  }

  // Pair each research action with its finding; keep everything else inline.
  const resultsByCallId = new Map(
    items
      .filter((item) => item.kind === "tool_result" && item.toolCallId)
      .map((item) => [item.toolCallId as string, item]),
  );
  const passes = [...new Set(items.map((item) => item.stepIndex))].sort(
    (a, b) => a - b,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="text-muted size-3.5" />
          <span className="text-muted text-sm">
            Thought for {formatDuration(run.durationMs)} · {run.toolCallCount}{" "}
            research {run.toolCallCount === 1 ? "action" : "actions"} ·{" "}
            {run.model}
          </span>
        </span>
        {run.status === "failed" ? (
          <Chip color="danger" size="sm" variant="soft">
            <Chip.Label>Run failed</Chip.Label>
          </Chip>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        {passes.map((pass, passIndex) => {
          const passItems = items.filter((item) => item.stepIndex === pass);
          const actionCount = passItems.filter(
            (item) => item.kind === "tool_call",
          ).length;

          return (
            <ChainOfThought key={pass} defaultExpanded>
              <ChainOfThought.Trigger>
                <span className="text-foreground font-medium">
                  {passIndex === passes.length - 1 && actionCount === 0
                    ? "Decision"
                    : `Research — pass ${passIndex + 1}`}
                </span>
                <span className="text-muted text-xs">
                  {actionCount > 0
                    ? `${actionCount} ${actionCount === 1 ? "action" : "actions"}`
                    : "reasoning"}
                </span>
              </ChainOfThought.Trigger>
              <ChainOfThought.Content>
                <ChainOfThought.Steps>
                  {passItems.map((item) => {
                    const key = `${item.stepIndex}-${item.itemIndex}`;

                    if (item.kind === "reasoning") {
                      const text = (item.content as { text?: string }).text;
                      if (!text) return null;
                      return (
                        <ChainOfThought.Step
                          key={key}
                          label={
                            <span className="text-foreground font-medium">
                              Thinking
                            </span>
                          }
                        >
                          <ClampedText
                            className="text-muted text-xs leading-relaxed"
                            lines={4}
                            text={text}
                          />
                        </ChainOfThought.Step>
                      );
                    }

                    if (item.kind === "tool_call") {
                      const meta = TOOL_META[item.toolName ?? ""] ?? {
                        label: item.toolName ?? "Action",
                        icon: Magnifier,
                      };
                      const result = item.toolCallId
                        ? resultsByCallId.get(item.toolCallId)
                        : undefined;
                      const evidence = result ? summarizeResult(result) : [];
                      const failed = Boolean(
                        result && (result.content as { error?: string }).error,
                      );

                      return (
                        <ChainOfThought.Step
                          key={key}
                          label={
                            <span
                              className={
                                failed
                                  ? "text-warning inline-flex items-center gap-1.5 font-medium"
                                  : "text-foreground inline-flex items-center gap-1.5 font-medium"
                              }
                            >
                              {failed ? (
                                <CircleExclamation className="size-3.5" />
                              ) : (
                                <meta.icon className="size-3.5" />
                              )}
                              {meta.label}
                            </span>
                          }
                        >
                          <div className="flex flex-col gap-1.5">
                            <span className="text-muted text-xs leading-relaxed">
                              {summarizeInput(item.content)}
                            </span>
                            {evidence.length > 0 ? (
                              <div className="bg-background/40 flex flex-col gap-0.5 rounded-lg border p-2.5 font-mono text-xs leading-relaxed">
                                {evidence.map((line) => (
                                  <span key={line}>{line}</span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </ChainOfThought.Step>
                      );
                    }

                    if (item.kind === "text") {
                      const text = (item.content as { text?: string }).text;
                      if (!text) return null;

                      // The structured answer arrives as JSON text — present
                      // the decision, not the wire format.
                      const answer = parseAnswer(text);
                      if (answer) {
                        return (
                          <ChainOfThought.Step
                            key={key}
                            label={
                              <span className="text-accent font-medium">
                                Classified {answer.htsCode}
                              </span>
                            }
                          >
                            <div className="flex flex-col gap-1.5">
                              {answer.summary ? (
                                <ClampedText
                                  className="text-muted text-xs leading-relaxed"
                                  lines={4}
                                  text={answer.summary}
                                />
                              ) : null}
                              <div className="bg-background/40 flex flex-col gap-0.5 rounded-lg border p-2.5 font-mono text-xs leading-relaxed">
                                <span>
                                  {answer.htsCode} · confidence{" "}
                                  {answer.confidence?.toFixed(2) ?? "—"}
                                </span>
                                {answer.duty ? (
                                  <span>duty: {answer.duty}</span>
                                ) : null}
                              </div>
                            </div>
                          </ChainOfThought.Step>
                        );
                      }

                      return (
                        <ChainOfThought.Step
                          key={key}
                          label={
                            <span className="text-accent font-medium">
                              Working notes
                            </span>
                          }
                        >
                          <ClampedText
                            className="text-muted text-xs leading-relaxed"
                            lines={4}
                            text={text}
                          />
                        </ChainOfThought.Step>
                      );
                    }

                    // Paired results render under their action.
                    return null;
                  })}
                </ChainOfThought.Steps>
              </ChainOfThought.Content>
            </ChainOfThought>
          );
        })}
      </div>
    </div>
  );
}
