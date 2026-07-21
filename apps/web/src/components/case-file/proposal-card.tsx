import {
  IconFileText,
  IconPencil,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Button } from "@heroui/react";
import { HoverCard, Widget } from "@heroui-pro/react";
import {
  CitationPill,
  findCitedDocument,
} from "#/components/case-file/citations";
import { ClampedText } from "#/components/clamped-text";
import { ConfidenceChip } from "#/components/confidence-chip";
import { formatCurrency } from "#/lib/format";
import type { ReviewItem } from "#/lib/review-types";

/**
 * The single-proposal decision card — the AI's answer, its confidence, the
 * money consequence, and the evidence behind it. Memo and response-draft
 * buttons render only when the caller wires them (i.e. the artifact exists).
 */
export function ProposalCard({
  item,
  onViewDraft,
  onViewMemo,
}: {
  item: ReviewItem;
  onViewDraft?: () => void;
  onViewMemo?: () => void;
}) {
  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>{item.proposal.label}</Widget.Title>
        {onViewMemo ? (
          <Button size="sm" variant="secondary" onPress={onViewMemo}>
            <IconFileText className="size-3.5" />
            View memo
          </Button>
        ) : null}
      </Widget.Header>
      <Widget.Content className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground text-xl font-semibold tabular-nums tracking-tight">
            {item.proposal.value}
          </span>
          <ConfidenceChip
            confidence={item.confidence}
            label="confident"
            size="md"
          />
        </div>
        <ClampedText text={item.proposal.detail} />
        {/* One quiet meta row: the money, the evidence, the artifact. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {item.dutyImpact ? (
            <HoverCard closeDelay={100} openDelay={150}>
              <HoverCard.Trigger className="inline-flex w-fit">
                <span className="border-border-secondary inline-flex cursor-default items-baseline gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5">
                  <span className="text-foreground text-sm font-semibold tabular-nums">
                    Duty {formatCurrency(item.dutyImpact.proposed.amountUsd)}
                  </span>
                  <span className="text-muted text-xs">
                    {item.dutyImpact.proposed.rate}
                  </span>
                </span>
              </HoverCard.Trigger>
              <HoverCard.Content className="p-3" placement="top">
                <div className="flex flex-col gap-1 font-mono text-xs leading-relaxed">
                  {item.dutyImpact.proposed.breakdown.map((line) => (
                    <span key={line} className="text-muted">
                      {line}
                    </span>
                  ))}
                </div>
              </HoverCard.Content>
            </HoverCard>
          ) : null}
          {item.citations.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted text-xs">Based on</span>
              {item.citations.slice(0, 2).map((citation) => (
                <CitationPill
                  key={citation.ref}
                  citation={citation}
                  document={findCitedDocument(item, citation)}
                />
              ))}
            </div>
          ) : null}
          {onViewDraft ? (
            <Button size="sm" variant="ghost" onPress={onViewDraft}>
              <IconPencil className="size-3.5" />
              Review response draft
            </Button>
          ) : null}
        </div>
      </Widget.Content>
    </Widget>
  );
}
