import { IconCircleCheck } from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Button, Chip, Separator } from "@heroui/react";
import { HoverCard, ItemCard, ItemCardGroup, Widget } from "@heroui-pro/react";
import { Fragment } from "react";
import { formatCurrency } from "#/lib/format";

/**
 * Alternates — the runner-up codes with duty deltas and a choose action,
 * styled to match the line classifications card (flush rows against the
 * widget edge). Shared between the single-line review overview and the
 * per-line drawer.
 */
export function AlternateClassificationsCard({
  alternates,
  deltaFor,
  onSelect,
  selected,
  title = "Alternate classifications",
}: {
  alternates: Array<{
    value: string;
    detail: string;
    confidence: number;
    reason?: string;
  }>;
  /** Duty change in USD if this code were chosen; undefined hides the delta. */
  deltaFor: (value: string) => number | undefined;
  /** Omit for a read-only list (outside the review flow). */
  onSelect?: (value: string | null) => void;
  selected?: string | null;
  title?: string;
}) {
  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>{title}</Widget.Title>
      </Widget.Header>
      {/* Cards sit flush against the widget content: no content padding, and
          the group's own outline is dropped in favor of the widget's edge. */}
      <Widget.Content className="p-0">
        <ItemCardGroup className="border-none" variant="outline">
          {alternates.map((alt, index) => {
            const isSelected = selected === alt.value;
            const deltaUsd = deltaFor(alt.value);

            return (
              <Fragment key={alt.value}>
                {index > 0 ? <Separator /> : null}
                <ItemCard className="gap-8 px-5 py-4">
                  <ItemCard.Content>
                    <ItemCard.Title className="whitespace-normal font-mono tabular-nums">
                      {alt.value}
                    </ItemCard.Title>
                    {/* The component truncates by default — let the detail
                        wrap instead. */}
                    <ItemCard.Description className="whitespace-normal leading-relaxed">
                      {alt.detail}
                    </ItemCard.Description>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      {/* Deliberately gray — the spectrum chip is reserved for
                          the chosen code; coloring runner-ups reads as a
                          verdict. */}
                      <Chip color="default" size="sm" variant="soft">
                        <Chip.Label>
                          {Math.round(alt.confidence * 100)}% confident
                        </Chip.Label>
                      </Chip>
                      {deltaUsd !== undefined ? (
                        <span
                          className={`text-xs font-medium tabular-nums ${
                            deltaUsd > 0
                              ? "text-danger"
                              : deltaUsd < 0
                                ? "text-success"
                                : "text-muted"
                          }`}
                        >
                          {deltaUsd === 0
                            ? "$0 duty change"
                            : `${deltaUsd > 0 ? "+" : "−"}${formatCurrency(Math.abs(deltaUsd))} duty`}
                        </span>
                      ) : null}
                      {alt.reason ? (
                        <HoverCard closeDelay={100} openDelay={150}>
                          <HoverCard.Trigger className="inline-flex w-fit">
                            <span className="text-muted cursor-help text-xs underline decoration-dashed underline-offset-2">
                              Why not?
                            </span>
                          </HoverCard.Trigger>
                          <HoverCard.Content
                            className="max-w-xs p-3"
                            placement="top"
                          >
                            <p className="text-muted text-xs leading-relaxed">
                              {alt.reason}
                            </p>
                          </HoverCard.Content>
                        </HoverCard>
                      ) : null}
                    </div>
                  </ItemCard.Content>
                  {onSelect ? (
                    <ItemCard.Action>
                      <Button
                        size="sm"
                        variant={isSelected ? "primary" : "outline"}
                        onPress={() => onSelect(isSelected ? null : alt.value)}
                      >
                        {isSelected ? (
                          <>
                            <IconCircleCheck className="size-3.5" />
                            Selected
                          </>
                        ) : (
                          "Choose alternative"
                        )}
                      </Button>
                    </ItemCard.Action>
                  ) : null}
                </ItemCard>
              </Fragment>
            );
          })}
        </ItemCardGroup>
      </Widget.Content>
    </Widget>
  );
}
