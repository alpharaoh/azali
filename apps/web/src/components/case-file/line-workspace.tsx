import {
  IconChevronRight,
  IconFileText,
  IconLaw,
  IconSparklesThree,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Button, Chip, Spinner, Tabs } from "@heroui/react";
import { Segment, TextShimmer, Widget } from "@heroui-pro/react";
import { useState } from "react";
import {
  DeterminationRow,
  determinationKey,
  determinationMeta,
} from "#/components/case-file/agency-determinations";
import { AgentRunTrace } from "#/components/case-file/agent-run-trace";
import { AlternateClassificationsCard } from "#/components/case-file/alternate-classifications-card";
import type { LineActivity } from "#/components/case-file/line-classifications-card";
import { LineClassificationsCard } from "#/components/case-file/line-classifications-card";
import { LineTraceTabs } from "#/components/case-file/line-trace-tabs";
import { MemoModal } from "#/components/case-file/memo-modal";
import { ClampedText } from "#/components/clamped-text";
import { ConfidenceChip } from "#/components/confidence-chip";
import { formatCurrency } from "#/lib/format";
import type {
  PgaAgencyDetermination,
  ReviewDocument,
  ReviewItem,
  ReviewLineItem,
} from "#/lib/review-types";
import { findLineMemo, findLineScreeningMemo } from "#/lib/review-types";

/* -------------------------------------------------------------------------------------------------
 * Line workspace — ONE umbrella for everything that is split by entry line.
 * An Overview tab shows every line's classification (and an agency-screening
 * summary); each line tab gathers that line's whole story in one place:
 * classification + alternates + memos, its agency determinations, and both
 * agent traces. Replaces the old scattered per-line surfaces (lines card,
 * PGA card, two trace tabs, and the slide-over drawer).
 * -----------------------------------------------------------------------------------------------*/

export type LineSelection = "overview" | number;

/** Per-line agency-screening chips, one row per line — the at-a-glance
 * complement to each line tab's full determinations. */
function AgencyScreeningSummary({
  byLine,
  flagTableVersion,
  onOpenLine,
}: {
  byLine: Map<number, PgaAgencyDetermination[]>;
  flagTableVersion?: ReviewItem["flagTableVersion"];
  onOpenLine: (lineNumber: number) => void;
}) {
  const entries = [...byLine.entries()].sort(([a], [b]) => a - b);

  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Agency screening</Widget.Title>
      </Widget.Header>
      <Widget.Content className="flex flex-col gap-0.5">
        {entries.map(([lineNumber, determinations]) => (
          <button
            key={lineNumber}
            className="hover:bg-default/40 -mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
            type="button"
            onClick={() => onOpenLine(lineNumber)}
          >
            <span className="text-muted shrink-0 text-xs tabular-nums">
              #{lineNumber}
            </span>
            <span className="text-foreground min-w-0 flex-1 truncate text-sm">
              {determinations[0]?.lineDescription}
            </span>
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {determinations.map((determination) => (
                <Chip
                  key={determinationKey(determination)}
                  color={determinationMeta[determination.determination].chip}
                  size="sm"
                  variant="soft"
                >
                  <Chip.Label>
                    {determination.agencyCode} ·{" "}
                    {determinationMeta[determination.determination].label}
                  </Chip.Label>
                </Chip>
              ))}
            </span>
            <IconChevronRight className="text-muted size-3.5 shrink-0" />
          </button>
        ))}
        {flagTableVersion ? (
          <span className="text-muted pt-2 text-xs">
            Screened against the agency flag reference current as of{" "}
            {flagTableVersion.publishedAt.slice(0, 10)}
          </span>
        ) : null}
      </Widget.Content>
    </Widget>
  );
}

/** One line's whole story: classification, alternates, agency
 * determinations, memos, and both agent traces. Keyed by line so the
 * memo/trace toggles reset when switching lines. */
function LinePanel({
  awaitingEmails,
  determinations,
  flagTableVersion,
  line,
  memo,
  onStageCorrection,
  pgaRunIdForLine,
  processing,
  runIdForLine,
  screening,
  screeningMemo,
  selectedAlternate,
  shipmentId,
}: {
  awaitingEmails: boolean;
  determinations: PgaAgencyDetermination[];
  flagTableVersion?: ReviewItem["flagTableVersion"];
  line: ReviewLineItem;
  memo: (ReviewDocument & { kind: "pdf" }) | null;
  /** Stage/clear this line's alternate — multi-line review only. */
  onStageCorrection?: (lineItemId: string, value: string | null) => void;
  pgaRunIdForLine: Record<number, string>;
  processing: string | null;
  runIdForLine: Record<number, string>;
  screening: boolean;
  screeningMemo: (ReviewDocument & { kind: "pdf" }) | null;
  selectedAlternate: string | null;
  shipmentId: string;
}) {
  const [traceAgent, setTraceAgent] = useState<"classification" | "pga">(
    "classification",
  );
  const [isMemoOpen, setMemoOpen] = useState(false);
  const [isScreeningMemoOpen, setScreeningMemoOpen] = useState(false);

  const duty = line.duty;
  const dutyLabel =
    duty?.effectivePct !== null && duty?.effectivePct !== undefined
      ? `${duty.effectivePct}% effective`
      : (duty?.label ?? null);
  const meta = [
    line.quantity !== null
      ? `${line.quantity}${line.unit ? ` ${line.unit}` : ""}`
      : null,
    line.valueUsd !== null ? formatCurrency(line.valueUsd) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      {/* Classification — the code, its rationale, and the money */}
      <Widget>
        <Widget.Header>
          <Widget.Title>Classification</Widget.Title>
          {memo ? (
            <Button size="sm" variant="ghost" onPress={() => setMemoOpen(true)}>
              <IconFileText className="size-3.5" />
              Rationale memo
            </Button>
          ) : null}
        </Widget.Header>
        <Widget.Content className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-foreground text-xl font-semibold tabular-nums tracking-tight">
              {line.htsCode ?? "—"}
            </span>
            <div className="flex items-center gap-2">
              {line.reused ? (
                <Chip
                  className="bg-purple-100 text-purple-900"
                  size="sm"
                  variant="soft"
                >
                  <Chip.Label>Reused</Chip.Label>
                </Chip>
              ) : null}
              {line.confidence !== null ? (
                <ConfidenceChip
                  confidence={line.confidence}
                  label="confident"
                  size="md"
                />
              ) : null}
            </div>
          </div>
          {line.summary ? <ClampedText text={line.summary} /> : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {duty?.amountUsd !== null && duty?.amountUsd !== undefined ? (
              <span className="border-border-secondary inline-flex w-fit cursor-default items-baseline gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5">
                <span className="text-foreground text-sm font-semibold tabular-nums">
                  Duty {formatCurrency(duty.amountUsd)}
                </span>
                {dutyLabel ? (
                  <span className="text-muted text-xs">{dutyLabel}</span>
                ) : null}
              </span>
            ) : null}
            {meta.length > 0 ? (
              <span className="text-muted text-xs">{meta.join(" · ")}</span>
            ) : null}
          </div>
        </Widget.Content>
      </Widget>

      {/* Alternates — a picker during a multi-line review, a record otherwise */}
      {line.alternates && line.alternates.length > 0 ? (
        <AlternateClassificationsCard
          alternates={line.alternates}
          deltaFor={(value) =>
            line.alternates?.find((alt) => alt.value === value)?.deltaUsd
          }
          selected={onStageCorrection ? selectedAlternate : undefined}
          onSelect={
            onStageCorrection
              ? (value) => onStageCorrection(line.lineItemId, value)
              : undefined
          }
        />
      ) : line.reused ? (
        <span className="text-muted text-xs">
          Reused from product memory — no alternates were scored for this line.
        </span>
      ) : null}

      {/* Agency screening — this line's PGA determinations */}
      {determinations.length > 0 || screeningMemo ? (
        <Widget>
          <Widget.Header>
            <Widget.Title>Agency screening</Widget.Title>
            {screeningMemo ? (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => setScreeningMemoOpen(true)}
              >
                <IconFileText className="size-3.5" />
                Screening memo
              </Button>
            ) : null}
          </Widget.Header>
          <Widget.Content className="flex flex-col gap-1">
            {determinations.map((determination) => (
              <DeterminationRow
                key={determinationKey(determination)}
                determination={determination}
              />
            ))}
            {determinations.length === 0 ? (
              <span className="text-muted text-sm">
                No agency determinations recorded for this line.
              </span>
            ) : null}
            {flagTableVersion ? (
              <span className="text-muted pt-2 text-xs">
                Screened against the agency flag reference current as of{" "}
                {flagTableVersion.publishedAt.slice(0, 10)}
              </span>
            ) : null}
          </Widget.Content>
        </Widget>
      ) : null}

      {/* Agent traces — both audit runs for this line, one toggle apart */}
      <Widget>
        <Widget.Header>
          <Widget.Title>Agent trace</Widget.Title>
          <Segment
            selectedKey={traceAgent}
            size="sm"
            onSelectionChange={(key) =>
              setTraceAgent(key === "pga" ? "pga" : "classification")
            }
          >
            <Segment.Item id="classification">
              <IconSparklesThree className="size-3.5" />
              Classification
            </Segment.Item>
            <Segment.Item id="pga">
              <IconLaw className="size-3.5" />
              Compliance
            </Segment.Item>
          </Segment>
        </Widget.Header>
        <Widget.Content>
          {traceAgent === "classification" ? (
            <LineTraceTabs
              activeLineNumber={line.lineNumber}
              isProcessing={processing !== null}
              lines={[line]}
              pendingMessage={
                awaitingEmails
                  ? "Classification starts once all related emails are in."
                  : undefined
              }
              runIdForLine={runIdForLine}
              onSelect={() => {}}
            />
          ) : (
            <LineTraceTabs
              activeLineNumber={line.lineNumber}
              agent="pga"
              isProcessing={processing !== null}
              lines={[line]}
              pendingMessage={
                screening
                  ? "Agency screening will reach this line shortly…"
                  : "Compliance screening starts once classification lands…"
              }
              runIdForLine={pgaRunIdForLine}
              onSelect={() => {}}
            />
          )}
        </Widget.Content>
      </Widget>

      {memo ? (
        <MemoModal
          key={memo.name}
          document={memo}
          eventType="classification_memo_drafted"
          isOpen={isMemoOpen}
          shipmentId={shipmentId}
          onOpenChange={setMemoOpen}
        />
      ) : null}
      {screeningMemo ? (
        <MemoModal
          key={screeningMemo.name}
          document={screeningMemo}
          eventType="pga_memo_drafted"
          isOpen={isScreeningMemoOpen}
          shipmentId={shipmentId}
          onOpenChange={setScreeningMemoOpen}
        />
      ) : null}
    </div>
  );
}

export function LineWorkspace({
  activityByLine,
  awaitingEmails = false,
  corrections,
  documents,
  documentsSlot,
  flagTableVersion,
  lines,
  linesLoaded,
  onSelect,
  onStageCorrection,
  pgaAgencies,
  pgaRunIdForLine,
  processing,
  runIdForLine,
  screening,
  selected,
  shipmentId,
  traceRunId,
}: {
  /** Live per-line state while classification is still running. */
  activityByLine?: Record<number, LineActivity>;
  awaitingEmails?: boolean;
  /** Staged per-line HTS substitutions — multi-line review only. */
  corrections?: Record<string, string>;
  /** Case-file documents, for per-line memo lookup. */
  documents: ReviewDocument[];
  /** The shipment's documents card — rendered on the Overview tab. */
  documentsSlot?: React.ReactNode;
  flagTableVersion?: ReviewItem["flagTableVersion"];
  lines: ReviewLineItem[];
  linesLoaded: boolean;
  onSelect: (selected: LineSelection) => void;
  /** Stage/clear a line's alternate — multi-line review only. */
  onStageCorrection?: (lineItemId: string, value: string | null) => void;
  /** Agency determinations from the screening payload, all lines. */
  pgaAgencies?: PgaAgencyDetermination[];
  pgaRunIdForLine: Record<number, string>;
  processing: string | null;
  runIdForLine: Record<number, string>;
  screening: boolean;
  selected: LineSelection;
  shipmentId: string;
  /** Headline audit run — the trace fallback when no lines exist yet. */
  traceRunId?: string;
}) {
  // No lines yet — one card carries the loading/empty story, plus the
  // headline trace when a run exists without lines.
  if (lines.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <LineClassificationsCard
          emptyMessage={
            processing
              ? "Entry lines appear once the commercial invoice is read…"
              : "No entry lines on file."
          }
          isLoading={!linesLoaded}
          lines={lines}
        />
        {linesLoaded && traceRunId ? (
          <Widget>
            <Widget.Header>
              <Widget.Title>Agent trace</Widget.Title>
            </Widget.Header>
            <Widget.Content>
              <AgentRunTrace runId={traceRunId} />
            </Widget.Content>
          </Widget>
        ) : null}
        {documentsSlot}
      </div>
    );
  }

  const determinationsByLine = new Map<number, PgaAgencyDetermination[]>();

  for (const determination of pgaAgencies ?? []) {
    const existing = determinationsByLine.get(determination.lineNumber) ?? [];
    determinationsByLine.set(determination.lineNumber, [
      ...existing,
      determination,
    ]);
  }

  // A stale numeric selection (line list refetched) falls back to Overview.
  const validSelected =
    selected !== "overview" &&
    lines.some((line) => line.lineNumber === selected)
      ? selected
      : "overview";
  const selectedKey =
    validSelected === "overview" ? "overview" : `line-${validSelected}`;

  return (
    <Tabs
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        const next = String(key);

        onSelect(
          next === "overview" ? "overview" : Number(next.replace("line-", "")),
        );
      }}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="Shipment lines" className="w-fit max-w-full">
          <Tabs.Tab className="w-fit" id="overview">
            Overview
            <Tabs.Indicator />
          </Tabs.Tab>
          {lines.map((line) => (
            <Tabs.Tab
              key={line.lineNumber}
              className="w-fit max-w-56 shrink-0"
              id={`line-${line.lineNumber}`}
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

      {/* Overview — every line at a glance, then screening across lines */}
      <Tabs.Panel className="flex flex-col gap-4 pt-3" id="overview">
        <LineClassificationsCard
          activityByLine={activityByLine}
          corrections={corrections}
          isLoading={!linesLoaded}
          lines={lines}
          onOpenLine={(line) => onSelect(line.lineNumber)}
          onViewTrace={(lineNumber) => onSelect(lineNumber)}
        />
        {screening && processing ? (
          <span className="inline-flex items-center gap-2 px-1">
            <Spinner size="sm" />
            <TextShimmer className="text-sm">{processing}</TextShimmer>
          </span>
        ) : null}
        {determinationsByLine.size > 0 ? (
          <AgencyScreeningSummary
            byLine={determinationsByLine}
            flagTableVersion={flagTableVersion}
            onOpenLine={onSelect}
          />
        ) : null}
        {documentsSlot}
      </Tabs.Panel>

      {/* One panel per line — the line's whole story in one place */}
      {lines.map((line) => (
        <Tabs.Panel
          key={line.lineNumber}
          className="pt-3"
          id={`line-${line.lineNumber}`}
        >
          <LinePanel
            key={line.lineItemId}
            awaitingEmails={awaitingEmails}
            determinations={determinationsByLine.get(line.lineNumber) ?? []}
            flagTableVersion={flagTableVersion}
            line={line}
            memo={findLineMemo(documents, line.lineNumber) ?? null}
            pgaRunIdForLine={pgaRunIdForLine}
            processing={processing}
            runIdForLine={runIdForLine}
            screening={screening}
            screeningMemo={
              findLineScreeningMemo(documents, line.lineNumber) ?? null
            }
            selectedAlternate={corrections?.[line.lineItemId] ?? null}
            shipmentId={shipmentId}
            onStageCorrection={onStageCorrection}
          />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
