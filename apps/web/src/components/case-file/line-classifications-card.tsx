import { ChevronRight } from "@gravity-ui/icons";
import { Chip, Separator } from "@heroui/react";
import {
  ChatLoader,
  ItemCard,
  ItemCardGroup,
  TextShimmer,
  Widget,
} from "@heroui-pro/react";
import { Fragment } from "react";
import { ConfidenceChip } from "#/components/confidence-chip";
import { formatCurrency } from "#/lib/format";
import { dutyTotals, type ReviewLineItem } from "#/lib/review-types";

/** What a not-yet-classified line is doing right now (detail page live view). */
export type LineActivity = "classifying" | "queued";

const NO_CORRECTIONS: Record<string, string> = {};

/**
 * Multi-line overview — the decision card aggregates every line: one row
 * per line with its classification verdict, and an invoice-style receipt
 * at the bottom. Rows drill into the line detail drawer when `onOpenLine`
 * is provided; without it the card is read-only (the shipment detail page
 * mid-processing).
 */
export function LineClassificationsCard({
  activityByLine,
  corrections = NO_CORRECTIONS,
  lines,
  onOpenLine,
  title = "Line classifications",
}: {
  /** Live per-line state while classification is still running. */
  activityByLine?: Record<number, LineActivity>;
  /** Staged per-line HTS substitutions (lineItemId → alternate code). */
  corrections?: Record<string, string>;
  lines: ReviewLineItem[];
  onOpenLine?: (line: ReviewLineItem) => void;
  title?: string;
}) {
  const totals = dutyTotals(lines, corrections);
  // Mid-processing there are no duty figures yet — a $0 receipt would lie.
  const showReceipt = lines.some(
    (line) =>
      line.duty?.amountUsd !== null && line.duty?.amountUsd !== undefined,
  );

  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>{title}</Widget.Title>
      </Widget.Header>
      <Widget.Content>
        <ItemCardGroup variant="outline">
          {lines.map((line, index) => {
            const staged = corrections[line.lineItemId];
            // Drill-down only once the line actually HAS a classification.
            const openLine =
              onOpenLine && line.htsCode ? onOpenLine : undefined;

            return (
              <Fragment key={line.lineItemId}>
                {index > 0 ? <Separator /> : null}
                <ItemCard
                  className={`gap-8 ${
                    openLine
                      ? "hover:bg-default/40 cursor-pointer transition-colors"
                      : ""
                  }`}
                  {...(openLine
                    ? {
                        role: "button" as const,
                        tabIndex: 0,
                        onClick: () => openLine(line),
                        onKeyDown: (event: React.KeyboardEvent) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openLine(line);
                          }
                        },
                      }
                    : {})}
                >
                  <ItemCard.Content>
                    <ItemCard.Title className="line-clamp-2 whitespace-normal">
                      {line.description}
                    </ItemCard.Title>
                    <ItemCard.Description className="tabular-nums">
                      {[
                        line.quantity !== null
                          ? `${line.quantity.toLocaleString("en-US")}${line.unit ? ` ${line.unit}` : ""}`
                          : null,
                        line.valueUsd !== null
                          ? formatCurrency(line.valueUsd)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </ItemCard.Description>
                    {line.reused || staged ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        {line.reused ? (
                          <Chip
                            className="bg-purple-100 text-purple-900"
                            size="sm"
                            variant="soft"
                          >
                            <Chip.Label>Reused</Chip.Label>
                          </Chip>
                        ) : null}
                        {staged ? (
                          <Chip
                            className="bg-accent/10 text-accent"
                            size="sm"
                            variant="soft"
                          >
                            <Chip.Label className="tabular-nums">
                              → {staged}
                            </Chip.Label>
                          </Chip>
                        ) : null}
                      </div>
                    ) : null}
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end gap-1">
                        {!line.htsCode &&
                        activityByLine?.[line.lineNumber] === "classifying" ? (
                          <span className="inline-flex items-center gap-2">
                            <ChatLoader.Dots size="sm" />
                            <TextShimmer className="text-xs">
                              Classifying…
                            </TextShimmer>
                          </span>
                        ) : !line.htsCode &&
                          activityByLine?.[line.lineNumber] === "queued" ? (
                          <Chip color="default" size="sm" variant="soft">
                            <Chip.Label>Queued</Chip.Label>
                          </Chip>
                        ) : (
                          <span className="text-foreground font-mono text-sm tabular-nums">
                            {line.htsCode ?? "Unclassified"}
                          </span>
                        )}
                        {line.confidence !== null ? (
                          <ConfidenceChip
                            confidence={line.confidence}
                            label="confident"
                          />
                        ) : null}
                        {line.duty?.amountUsd !== null &&
                        line.duty?.amountUsd !== undefined ? (
                          <span className="text-muted text-xs tabular-nums">
                            Duty {formatCurrency(line.duty.amountUsd)}
                          </span>
                        ) : null}
                      </div>
                      {openLine ? (
                        <ChevronRight className="text-muted size-4 shrink-0" />
                      ) : null}
                    </div>
                  </ItemCard.Action>
                </ItemCard>
              </Fragment>
            );
          })}
          {showReceipt ? <Separator /> : null}
          {/* Invoice-style receipt — pr matches the rows' duty column (card
              padding + chevron + gap) so the figures line up. */}
          {showReceipt ? (
            <div
              className={`flex flex-col gap-1 py-2.5 pl-4 ${onOpenLine ? "pr-11" : "pr-4"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted text-xs">Total value</span>
                <span className="text-foreground text-xs tabular-nums">
                  {formatCurrency(totals.totalValueUsd)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted text-xs">Total duty</span>
                <span className="text-foreground text-xs font-semibold tabular-nums">
                  {formatCurrency(totals.amountUsd)}
                </span>
              </div>
              {totals.effectivePct !== null ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted text-xs">
                    Effective duty rate
                  </span>
                  <span className="text-foreground text-xs tabular-nums">
                    {totals.effectivePct.toFixed(1)}%
                  </span>
                </div>
              ) : null}
              {totals.unpricedCount > 0 ? (
                <span className="text-muted text-xs">
                  Total excludes {totals.unpricedCount} line
                  {totals.unpricedCount === 1 ? "" : "s"} without ad-valorem
                  duty
                </span>
              ) : null}
            </div>
          ) : null}
        </ItemCardGroup>
      </Widget.Content>
    </Widget>
  );
}
