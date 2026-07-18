import { IconSparklesThree } from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Chip, Tabs } from "@heroui/react";
import { TextShimmer } from "@heroui-pro/react";
import { AgentRunTrace } from "#/components/case-file/agent-run-trace";
import type { ReviewLineItem } from "#/lib/review-types";

/**
 * Per-line agent traces behind chip-numbered tabs — the one trace surface
 * shared by the review workspace and the shipment detail page. Renders the
 * active line's audit run, or the right empty state (reused from memory /
 * run not started yet / nothing recorded).
 */
export function LineTraceTabs({
  activeLineNumber,
  isProcessing = false,
  lines,
  onSelect,
  pendingMessage,
  runIdForLine,
}: {
  activeLineNumber: number | undefined;
  /** Softens the empty state while the pipeline is still running. */
  isProcessing?: boolean;
  /** Overrides the not-started-yet copy when the caller knows why the run
   * hasn't begun (e.g. still collecting related emails). */
  pendingMessage?: string;
  lines: ReviewLineItem[];
  onSelect: (lineNumber: number) => void;
  /** The audit run behind each line (row runId or a live run.started). */
  runIdForLine: Record<number, string>;
}) {
  const activeLine = lines.find((line) => line.lineNumber === activeLineNumber);
  const activeRunId =
    activeLineNumber !== undefined ? runIdForLine[activeLineNumber] : undefined;

  return (
    <div className="flex flex-col gap-3">
      {lines.length > 1 ? (
        <Tabs
          selectedKey={String(activeLineNumber ?? "")}
          variant="secondary"
          onSelectionChange={(key) => onSelect(Number(key))}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Line item traces" className="w-fit">
              {lines.map((line) => (
                <Tabs.Tab
                  key={line.lineNumber}
                  className="w-fit max-w-56 shrink-0"
                  id={String(line.lineNumber)}
                >
                  <Chip className="mr-1.5 shrink-0" size="sm" variant="soft">
                    <Chip.Label className="tabular-nums">
                      {line.lineNumber}
                    </Chip.Label>
                  </Chip>
                  <span className="min-w-0 truncate whitespace-nowrap">
                    {line.description}
                  </span>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      ) : null}

      {activeRunId ? (
        <AgentRunTrace key={activeRunId} runId={activeRunId} />
      ) : activeLine?.reused ? (
        <span className="text-muted text-sm">
          Reused from product memory — this line's classification came from an
          earlier broker-verified decision, so there is no fresh audit run.
        </span>
      ) : isProcessing ? (
        <span className="inline-flex items-center gap-2 py-1">
          <IconSparklesThree className="text-muted size-4" />
          <TextShimmer className="text-sm">
            {pendingMessage ?? "The agent will start on this line shortly…"}
          </TextShimmer>
        </span>
      ) : (
        <span className="text-muted text-sm">
          No audit run recorded for this line.
        </span>
      )}
    </div>
  );
}
