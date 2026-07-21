import {
  IconChevronRight,
  IconFileText,
  IconLaw,
  IconSparklesThree,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Button, Chip, Separator, Spinner, Tabs } from "@heroui/react";
import {
  ItemCard,
  ItemCardGroup,
  Segment,
  TextShimmer,
  Widget,
} from "@heroui-pro/react";
import { Fragment, useState } from "react";
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

/** Per-line agency screening in the same idiom as the line classifications
 * card: what the line is, each agency's verdict with its confidence, and a
 * headline outcome on the right. Rows drill into the line's tab. */
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
      <Widget.Content className="p-0">
        <ItemCardGroup className="border-none" variant="outline">
          {entries.map(([lineNumber, determinations], index) => {
            const required = determinations.filter(
              (determination) => determination.determination === "required",
            ).length;
            const disclaim = determinations.filter(
              (determination) => determination.determination === "disclaim",
            ).length;

            return (
              <Fragment key={lineNumber}>
                {index > 0 ? <Separator /> : null}
                <ItemCard
                  className="hover:bg-default/40 cursor-pointer gap-8 px-5 py-4 transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenLine(lineNumber)}
                  onKeyDown={(event: React.KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenLine(lineNumber);
                    }
                  }}
                >
                  <ItemCard.Content>
                    <ItemCard.Title className="line-clamp-2 whitespace-normal">
                      {determinations[0]?.lineDescription}
                    </ItemCard.Title>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      {determinations.map((determination) => (
                        <span
                          key={determinationKey(determination)}
                          className="flex items-center gap-1"
                        >
                          <Chip
                            color={
                              determinationMeta[determination.determination]
                                .chip
                            }
                            size="sm"
                            variant="soft"
                          >
                            <Chip.Label>
                              {determination.agencyCode} ·{" "}
                              {
                                determinationMeta[determination.determination]
                                  .label
                              }
                            </Chip.Label>
                          </Chip>
                          <ConfidenceChip
                            confidence={determination.confidence}
                          />
                        </span>
                      ))}
                    </div>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <div className="flex items-center gap-3">
                      <span
                        className={`whitespace-nowrap text-xs ${
                          required > 0
                            ? "text-danger font-medium"
                            : disclaim > 0
                              ? "text-warning"
                              : "text-muted"
                        }`}
                      >
                        {required > 0
                          ? `${required} filing${required === 1 ? "" : "s"} required`
                          : disclaim > 0
                            ? `${disclaim} disclaimer${disclaim === 1 ? "" : "s"} to file`
                            : "No filings applicable"}
                      </span>
                      <IconChevronRight className="text-muted size-4 shrink-0" />
                    </div>
                  </ItemCard.Action>
                </ItemCard>
              </Fragment>
            );
          })}
        </ItemCardGroup>
        {flagTableVersion ? (
          <div className="border-t px-5 py-3">
            <span className="text-muted text-xs">
              Screened against the agency flag reference current as of{" "}
              {flagTableVersion.publishedAt.slice(0, 10)}
            </span>
          </div>
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
  emphasis = "classification",
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
  /** What the broker is here to judge. "screening" (PGA reviews) leads
   * with the agency determinations and demotes classification to a
   * compact fact-check record. */
  emphasis?: "classification" | "screening";
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
    emphasis === "screening" ? "pga" : "classification",
  );
  const [isMemoOpen, setMemoOpen] = useState(false);
  const [isScreeningMemoOpen, setScreeningMemoOpen] = useState(false);

  // The Compliance trace toggle only appears once there is (or is about to
  // be) a screening run for this line — before that it's just noise.
  const hasComplianceTrace =
    Boolean(pgaRunIdForLine[line.lineNumber]) || screening;

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

  // Classification: the full decision card when classification is what's
  // being judged; a compact one-row fact-check record when the broker is
  // here for the screening.
  const classificationSection =
    emphasis === "screening" ? (
      // Not a widget — one quiet line of record above the decision, there
      // to fact-check and otherwise out of the way.
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-muted text-xs">Classified as</span>
          <span className="text-foreground font-mono text-sm font-semibold tabular-nums">
            {line.htsCode ?? "—"}
          </span>
          {duty?.amountUsd !== null && duty?.amountUsd !== undefined ? (
            <span className="text-muted text-xs tabular-nums">
              · Duty {formatCurrency(duty.amountUsd)}
            </span>
          ) : null}
        </div>
        {memo ? (
          <Button
            size="sm"
            variant="secondary"
            onPress={() => setMemoOpen(true)}
          >
            <IconFileText className="size-3.5" />
            Rationale memo
          </Button>
        ) : null}
      </div>
    ) : (
      <Widget>
        <Widget.Header>
          <Widget.Title>Classification</Widget.Title>
          {memo ? (
            <Button
              size="sm"
              variant="secondary"
              onPress={() => setMemoOpen(true)}
            >
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
    );

  // Alternates — classification decision material; hidden when the broker
  // is here for the screening.
  const alternatesSection =
    line.alternates && line.alternates.length > 0 ? (
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
    ) : null;

  // Agency screening — this line's PGA determinations.
  const screeningSection =
    emphasis === "screening" || determinations.length > 0 || screeningMemo ? (
      <Widget>
        <Widget.Header>
          <Widget.Title>Agency screening</Widget.Title>
          {screeningMemo ? (
            <Button
              size="sm"
              variant="secondary"
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
    ) : null;

  // Agent traces — both audit runs for this line, one toggle apart
  // (classification only until a screening run exists).
  const traceSection = (
    <Widget>
      <Widget.Header>
        <Widget.Title>Agent trace</Widget.Title>
        {hasComplianceTrace ? (
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
        ) : null}
      </Widget.Header>
      <Widget.Content>
        {traceAgent === "classification" || !hasComplianceTrace ? (
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
  );

  return (
    <div className="flex flex-col gap-4">
      {emphasis === "screening" ? (
        <>
          {/* One line of classification record on top, then the decision:
              the screening itself. */}
          {classificationSection}
          {screeningSection}
          {traceSection}
        </>
      ) : (
        <>
          {classificationSection}
          {alternatesSection}
          {screeningSection}
          {traceSection}
        </>
      )}

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
  emphasis = "classification",
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
  /** What the broker is here to judge. "screening" (PGA reviews) leads
   * every surface with the agency determinations and demotes
   * classification to a compact record. */
  emphasis?: "classification" | "screening";
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

      {/* Overview — what the broker is here to judge leads: the screening
          across lines for PGA reviews, every line's classification
          otherwise. */}
      <Tabs.Panel className="flex flex-col gap-4 pt-3" id="overview">
        {emphasis !== "screening" ? (
          <LineClassificationsCard
            activityByLine={activityByLine}
            corrections={corrections}
            isLoading={!linesLoaded}
            lines={lines}
            onOpenLine={(line) => onSelect(line.lineNumber)}
            onViewTrace={(lineNumber) => onSelect(lineNumber)}
          />
        ) : null}
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
        ) : emphasis === "screening" ? (
          // Screening emphasis with nothing screened yet — fall back to the
          // lines so the overview is never empty.
          <LineClassificationsCard
            activityByLine={activityByLine}
            isLoading={!linesLoaded}
            lines={lines}
            onOpenLine={(line) => onSelect(line.lineNumber)}
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
            emphasis={emphasis}
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
