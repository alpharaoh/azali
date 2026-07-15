import {
  Book,
  CircleExclamation,
  DatabaseMagnifier,
  FileText,
  Globe,
  Magnifier,
  Sparkles,
} from "@gravity-ui/icons";
import { Chip, Link, Skeleton } from "@heroui/react";
import { ChainOfThought, ChatLoader, TextShimmer } from "@heroui-pro/react";
import type { ComponentType, SVGProps } from "react";
import { useEffect, useRef } from "react";
import crossLogo from "#/assets/cross-logo.png";
import htsBadge from "#/assets/htsus.svg";
import { useRealtimeConnected } from "#/lib/realtime";
import type { AgentRunDetailResponseDtoItemsItem as RunItem } from "@/generated/api";
import { useAgentRunsControllerFind } from "@/generated/api";
import { ClampedText } from "./clamped-text";

/* -------------------------------------------------------------------------------------------------
 * The agent trace, rendered directly from the canonical audit record
 * (agent_runs / agent_run_items) — reasoning, narration, every research
 * action with its source system, the exact search URL it hit, and what it
 * found, in the order it happened.
 * -----------------------------------------------------------------------------------------------*/

type SourceName = "HTSUS" | "CROSS" | "Knowledge base" | "Web";

const TOOL_META: Record<
  string,
  {
    label: string;
    source: SourceName;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
  }
> = {
  searchHts: {
    label: "Searched the tariff schedule",
    source: "HTSUS",
    icon: Magnifier,
  },
  browseHtsHeading: {
    label: "Browsed a tariff heading",
    source: "HTSUS",
    icon: Book,
  },
  getChapterNotes: {
    label: "Read the chapter notes",
    source: "HTSUS",
    icon: Book,
  },
  searchRulings: {
    label: "Searched customs rulings",
    source: "CROSS",
    icon: Magnifier,
  },
  getRuling: {
    label: "Read a ruling in full",
    source: "CROSS",
    icon: FileText,
  },
  searchKnowledge: {
    label: "Searched the importer's record",
    source: "Knowledge base",
    icon: Magnifier,
  },
  webSearch: {
    label: "Searched the web",
    source: "Web",
    icon: Globe,
  },
};

/** Source badge — official marks for the government databases. */
function SourceBadge({ source }: { source: SourceName }) {
  if (source === "HTSUS") {
    return (
      <Chip className="bg-[#1A4480] text-white" size="sm" variant="soft">
        <Chip.Label className="inline-flex items-center gap-1">
          <img
            alt=""
            className="h-3 w-auto"
            height={14}
            loading="lazy"
            src={htsBadge}
          />
          HTS
        </Chip.Label>
      </Chip>
    );
  }
  if (source === "CROSS") {
    return (
      <Chip className="bg-sky-100 text-sky-900" size="sm" variant="soft">
        <Chip.Label className="inline-flex items-center gap-1">
          <img
            alt=""
            className="size-3 rounded-full"
            height={12}
            loading="lazy"
            src={crossLogo}
            width={12}
          />
          CROSS
        </Chip.Label>
      </Chip>
    );
  }
  if (source === "Web") {
    return (
      <Chip color="success" size="sm" variant="soft">
        <Chip.Label className="inline-flex items-center gap-1">
          <Globe className="size-3" />
          Web
        </Chip.Label>
      </Chip>
    );
  }
  return (
    <Chip className="bg-purple-100 text-purple-900" size="sm" variant="soft">
      <Chip.Label className="inline-flex items-center gap-1">
        <DatabaseMagnifier className="size-3" />
        Knowledge base
      </Chip.Label>
    </Chip>
  );
}

/** "{"query":"wifi router"}" → wifi router · Chapter 85 · … */
function summarizeInput(content: Record<string, unknown>): string {
  const input = content.input;
  if (!input || typeof input !== "object") return "";
  return Object.values(input as Record<string, unknown>)
    .filter((value) => value !== undefined && value !== null)
    .map(String)
    .join(" · ");
}

interface ToolEnvelope {
  source?: string;
  url?: string;
  lines?: unknown;
  rulings?: unknown;
  notes?: unknown;
  matches?: unknown;
  totalHits?: number;
}

/** The exact search URL a tool hit, when the source is public. */
function resultUrl(result: RunItem | undefined): string | null {
  if (!result) return null;
  const output = (result.content as { output?: ToolEnvelope }).output;
  return typeof output?.url === "string" ? output.url : null;
}

function summarizeHtsLines(lines: unknown): string[] {
  const rows = (
    lines as Array<{ htsNumber: string; description: string; general: string }>
  ).filter((line) => line.htsNumber);
  return [
    ...rows
      .slice(0, 5)
      .map(
        (line) =>
          `${line.htsNumber}  ${line.description.slice(0, 64)}${line.general ? `  (${line.general})` : ""}`,
      ),
    ...(rows.length > 5 ? [`… ${rows.length - 5} more lines`] : []),
  ];
}

function summarizeRulings(value: {
  totalHits?: number;
  rulings: Array<{ rulingNumber: string; subject: string; revoked: boolean }>;
}): string[] {
  return [
    `${value.totalHits ?? value.rulings.length} hits`,
    ...value.rulings
      .slice(0, 4)
      .map(
        (ruling) =>
          `${ruling.rulingNumber}  ${ruling.subject.slice(0, 64)}${ruling.revoked ? "  [REVOKED]" : ""}`,
      ),
  ];
}

function summarizeMatches(matches: unknown): string[] {
  return (matches as Array<{ text: string; score: number }>)
    .slice(0, 3)
    .map(
      (match) =>
        `${match.score.toFixed(2)}  ${match.text.slice(0, 70).replace(/\n/g, " ")}`,
    );
}

function summarizeWebResults(output: unknown): string[] {
  const results = output as Array<{ url: string; title: string | null }>;
  return results.slice(0, 4).map((result) => {
    let host = "";
    try {
      host = new URL(result.url).hostname.replace(/^www\./, "");
    } catch {
      host = result.url.slice(0, 40);
    }
    return `${(result.title ?? result.url).slice(0, 64)}  — ${host}`;
  });
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
  const envelope = (output ?? {}) as ToolEnvelope;

  try {
    switch (item.toolName) {
      case "searchHts":
      case "browseHtsHeading":
        // Envelope shape; legacy runs stored the bare array.
        return summarizeHtsLines(envelope.lines ?? output);
      case "getChapterNotes": {
        const notes = envelope.notes ?? output;
        return [`${String(notes).slice(0, 110).replace(/\n/g, " ")}…`];
      }
      case "searchRulings":
        return summarizeRulings(
          (envelope.rulings ? envelope : output) as Parameters<
            typeof summarizeRulings
          >[0],
        );
      case "getRuling": {
        const value = output as { rulingNumber: string; subject: string };
        return [`${value.rulingNumber}  ${value.subject.slice(0, 80)}`];
      }
      case "searchKnowledge":
        return summarizeMatches(envelope.matches ?? output);
      case "webSearch":
        return summarizeWebResults(output);
      default:
        return [JSON.stringify(output).slice(0, 110)];
    }
  } catch {
    return [];
  }
}

interface AnswerView {
  htsCode: string;
  confidence?: number;
  summary?: string;
  dutyGeneral?: string | null;
  dutyEffective?: string | null;
  dutyPct?: number | null;
}

function toAnswerView(value: unknown): AnswerView | null {
  const answer = value as {
    htsCode?: string;
    confidence?: number;
    summary?: string;
    dutyRate?: {
      general?: string | null;
      effective?: string | null;
      effectivePct?: number | null;
    };
  };
  if (typeof answer?.htsCode !== "string") return null;
  return {
    htsCode: answer.htsCode,
    confidence: answer.confidence,
    summary: answer.summary,
    dutyGeneral: answer.dutyRate?.general ?? null,
    dutyEffective: answer.dutyRate?.effective ?? null,
    dutyPct: answer.dutyRate?.effectivePct ?? null,
  };
}

/** The final answer text item is the structured output as JSON. */
function parseAnswer(text: string): AnswerView | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    return toAnswerView(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

function DecisionBody({ answer }: { answer: AnswerView }) {
  return (
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
          {answer.htsCode} · confidence {answer.confidence?.toFixed(2) ?? "—"}
        </span>
        {answer.dutyEffective ? (
          <span>duty: {answer.dutyEffective}</span>
        ) : null}
      </div>
    </div>
  );
}

function formatDuration(durationMs: number | null): string {
  if (!durationMs) return "a moment";
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 90) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m ${seconds % 60}s`;
}

/** Mimics the loaded trace's structure so the swap doesn't jump. */
function TraceSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-3.5 w-64 rounded-md" />
      </div>
      {[0, 1].map((pass) => (
        <div key={pass} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="h-3 w-12 rounded-md" />
          </div>
          <div className="flex flex-col gap-3 pl-1.5">
            {[0, 1, pass === 0 ? 2 : -1]
              .filter((step) => step >= 0)
              .map((step) => (
                <div key={step} className="flex gap-3">
                  <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
                  <div className="flex w-full flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3.5 w-44 rounded-md" />
                      <Skeleton className="h-4 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-56 rounded-md" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Present-tense label for what the agent is doing right now, derived from
 * the last persisted item (an unanswered research action, or thinking). */
function tailLabel(
  items: RunItem[],
  resultsByCallId: Map<string, RunItem>,
): string {
  const last = items[items.length - 1];
  if (
    last?.kind === "tool_call" &&
    last.toolName !== "submitClassification" &&
    (!last.toolCallId || !resultsByCallId.has(last.toolCallId))
  ) {
    const label = TOOL_META[last.toolName ?? ""]?.label;
    // "Searched the tariff schedule" → "Searching the tariff schedule…"
    if (label) {
      return `${label
        .replace(/^Searched/, "Searching")
        .replace(/^Browsed/, "Browsing")
        .replace(/^Read/, "Reading")}…`;
    }
    return "Researching…";
  }
  return "Thinking…";
}

export function AgentRunTrace({ runId }: { runId: string }) {
  const connected = useRealtimeConnected();
  const { data, isLoading } = useAgentRunsControllerFind(runId, {
    query: {
      // Live items normally arrive over the websocket; while it is down,
      // poll a running run so the trace still advances.
      refetchInterval: (query) =>
        query.state.data?.data.run.status === "running" && !connected
          ? 3000
          : false,
    },
  });

  // Follow the live tail only when the reader is already at the bottom —
  // never yank the page away from someone reading an earlier pass.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const itemCount = data?.data.items.length ?? 0;
  const running = data?.data.run.status === "running";
  // biome-ignore lint/correctness/useExhaustiveDependencies: itemCount is the trigger — re-check the tail whenever a new item lands
  useEffect(() => {
    if (!running) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const distance =
      sentinel.getBoundingClientRect().top -
      (window.innerHeight || document.documentElement.clientHeight);
    if (distance < 150) {
      sentinel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [itemCount, running]);

  if (isLoading) return <TraceSkeleton />;

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
  const isRunning = run.status === "running";
  const liveActionCount = items.filter(
    (item) => item.kind === "tool_call",
  ).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="text-muted size-3.5" />
          {isRunning ? (
            <TextShimmer className="text-sm">
              {`Working — ${liveActionCount} research ${liveActionCount === 1 ? "action" : "actions"} so far`}
            </TextShimmer>
          ) : (
            <span className="text-muted text-sm">
              Thought for {formatDuration(run.durationMs)} · {run.toolCallCount}{" "}
              research {run.toolCallCount === 1 ? "action" : "actions"}
            </span>
          )}
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

                    if (
                      item.kind === "tool_call" &&
                      item.toolName === "submitClassification"
                    ) {
                      const answer = toAnswerView(
                        (item.content as { input?: unknown }).input,
                      );
                      if (!answer) return null;
                      return (
                        <ChainOfThought.Step
                          key={key}
                          label={
                            <span className="text-accent font-medium">
                              Classified {answer.htsCode}
                            </span>
                          }
                        >
                          <DecisionBody answer={answer} />
                        </ChainOfThought.Step>
                      );
                    }

                    if (item.kind === "tool_call") {
                      const meta = TOOL_META[item.toolName ?? ""] ?? {
                        label: item.toolName ?? "Action",
                        source: "Knowledge base" as const,
                        icon: Magnifier,
                      };
                      const result = item.toolCallId
                        ? resultsByCallId.get(item.toolCallId)
                        : undefined;
                      const evidence = result ? summarizeResult(result) : [];
                      const url = resultUrl(result);
                      const query = summarizeInput(item.content);
                      const failed = Boolean(
                        result && (result.content as { error?: string }).error,
                      );

                      return (
                        <ChainOfThought.Step
                          key={key}
                          label={
                            <span className="inline-flex flex-wrap items-center gap-1.5">
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
                              <SourceBadge source={meta.source} />
                            </span>
                          }
                        >
                          <div className="flex flex-col gap-1.5">
                            {url ? (
                              <Link
                                className="w-fit text-xs"
                                href={url}
                                rel="noreferrer"
                                target="_blank"
                              >
                                {query || url}
                                <Link.Icon className="size-3" />
                              </Link>
                            ) : query ? (
                              <span className="text-muted text-xs leading-relaxed">
                                {query}
                                {meta.source === "Knowledge base"
                                  ? " · classification engine"
                                  : ""}
                              </span>
                            ) : null}
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
                            <DecisionBody answer={answer} />
                          </ChainOfThought.Step>
                        );
                      }

                      return (
                        <ChainOfThought.Step
                          key={key}
                          label={
                            <span className="text-foreground font-medium">
                              Analysis
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

      {isRunning ? (
        <div className="flex items-center gap-2 py-1.5">
          <ChatLoader.Dots size="sm" />
          <TextShimmer className="text-xs">
            {tailLabel(items, resultsByCallId)}
          </TextShimmer>
        </div>
      ) : null}
      <div ref={sentinelRef} aria-hidden="true" />
    </div>
  );
}
