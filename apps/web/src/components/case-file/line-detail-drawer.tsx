import {
  IconArrowRedoDown,
  IconArrowUndoUp,
  IconBold,
  IconBulletList,
  IconH2,
  IconH3,
  IconItalic,
  IconNumberedList,
  IconSparklesThree,
  IconUnderline,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Button, Chip, Drawer, toast } from "@heroui/react";
import { RichTextEditor, Segment } from "@heroui-pro/react";
import { useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/core";
import { useRef, useState } from "react";

import { AgentRunTrace } from "#/components/case-file/agent-run-trace";
import { AlternateClassificationsCard } from "#/components/case-file/alternate-classifications-card";
import { ClampedText } from "#/components/clamped-text";
import { ConfidenceChip } from "#/components/confidence-chip";
import {
  getShipmentEventsControllerFindByShipmentQueryKey,
  useShipmentEventsControllerCreate,
} from "#/generated/api";
import { formatCurrency } from "#/lib/format";
import type { ReviewDocument, ReviewLineItem } from "#/lib/review-types";

/* -------------------------------------------------------------------------------------------------
 * Inline memo editor — the line's rationale memo, editable in place. Saving
 * appends a revision to the shipment's event stream (the file stays
 * append-only), same as the CF-28 response draft flow.
 * -----------------------------------------------------------------------------------------------*/
function MemoEditor({
  document,
  shipmentId,
}: {
  document: ReviewDocument & { kind: "pdf" };
  shipmentId: string;
}) {
  const queryClient = useQueryClient();
  const createEvent = useShipmentEventsControllerCreate();
  const [isSaving, setIsSaving] = useState(false);
  // The latest editor state, captured without re-rendering per keystroke.
  const latest = useRef<{ draft: JSONContent; words: number } | null>(null);

  const handleSave = () => {
    const revision = latest.current;
    const run = createEvent
      .mutateAsync({
        shipmentId,
        data: {
          type: "classification_memo_drafted",
          actor: "user",
          title: `${document.name.split("·")[0]?.trim() ?? "Rationale memo"} revised`,
          payload: {
            ...document,
            receivedHoursAgo: 0,
            ...(revision && { draft: revision.draft }),
            note: revision
              ? `Revised by the broker · ${revision.words} words`
              : document.note,
          },
        },
      })
      .then(async () => {
        await queryClient.invalidateQueries({
          queryKey:
            getShipmentEventsControllerFindByShipmentQueryKey(shipmentId),
        });
      });

    setIsSaving(true);
    toast.promise(
      run.finally(() => setIsSaving(false)),
      {
        error: "Failed to save the memo",
        loading: "Saving memo to the file...",
        success: "Memo revision saved to the file",
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <RichTextEditor
        defaultValue={document.draft as JSONContent}
        onValueChange={(value, details) => {
          latest.current = { draft: value, words: details.wordCount };
        }}
      >
        <RichTextEditor.Shell>
          <RichTextEditor.Toolbar aria-label="Memo formatting">
            <RichTextEditor.ToolbarGroup>
              <RichTextEditor.ActionButton action="undo" tooltip="Undo">
                <IconArrowUndoUp className="size-3.5" />
              </RichTextEditor.ActionButton>
              <RichTextEditor.ActionButton action="redo" tooltip="Redo">
                <IconArrowRedoDown className="size-3.5" />
              </RichTextEditor.ActionButton>
            </RichTextEditor.ToolbarGroup>
            <RichTextEditor.ToolbarSeparator />
            <RichTextEditor.ToolbarGroup>
              <RichTextEditor.ToggleButton
                command="heading-2"
                tooltip="Heading"
              >
                <IconH2 className="size-3.5" />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton
                command="heading-3"
                tooltip="Subheading"
              >
                <IconH3 className="size-3.5" />
              </RichTextEditor.ToggleButton>
            </RichTextEditor.ToolbarGroup>
            <RichTextEditor.ToolbarSeparator />
            <RichTextEditor.ToolbarGroup>
              <RichTextEditor.ToggleButton command="bold" tooltip="Bold">
                <IconBold className="size-3.5" />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton command="italic" tooltip="Italic">
                <IconItalic className="size-3.5" />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton
                command="underline"
                tooltip="Underline"
              >
                <IconUnderline className="size-3.5" />
              </RichTextEditor.ToggleButton>
            </RichTextEditor.ToolbarGroup>
            <RichTextEditor.ToolbarSeparator />
            <RichTextEditor.ToolbarGroup>
              <RichTextEditor.ToggleButton
                command="bulletList"
                tooltip="Bulleted list"
              >
                <IconBulletList className="size-3.5" />
              </RichTextEditor.ToggleButton>
              <RichTextEditor.ToggleButton
                command="orderedList"
                tooltip="Numbered list"
              >
                <IconNumberedList className="size-3.5" />
              </RichTextEditor.ToggleButton>
            </RichTextEditor.ToolbarGroup>
          </RichTextEditor.Toolbar>
          <RichTextEditor.Content className="min-h-160" />
          <RichTextEditor.Footer>
            <span className="text-muted text-xs">
              Saving appends a revision to the audit record
            </span>
            <RichTextEditor.CharacterCount showWords />
          </RichTextEditor.Footer>
        </RichTextEditor.Shell>
      </RichTextEditor>
      <div className="flex justify-end">
        <Button
          isPending={isSaving}
          size="sm"
          variant="primary"
          onPress={handleSave}
        >
          Save memo
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Line detail drawer — one line's full classification: code, rationale,
 * duty, its own alternates, its memo, and its agent trace (switched via
 * an Overview / Agent trace segment, mirroring the main detail pane).
 * -----------------------------------------------------------------------------------------------*/
export function LineDetailDrawer({
  line,
  memo,
  onOpenChange,
  onSelectAlternate,
  selectedAlternate,
  shipmentId,
}: {
  line: ReviewLineItem | null;
  /** This line's rationale memo document, when one is in the case file. */
  memo: (ReviewDocument & { kind: "pdf" }) | null;
  onOpenChange: (open: boolean) => void;
  /** Omit for a read-only drawer (outside the review flow). */
  onSelectAlternate?: (value: string | null) => void;
  selectedAlternate?: string | null;
  shipmentId: string;
}) {
  return (
    <Drawer isOpen={Boolean(line)} onOpenChange={onOpenChange}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="sm:max-w-180 w-full">
            {line ? (
              <LineDetailContent
                key={line.lineItemId}
                line={line}
                memo={memo}
                selectedAlternate={selectedAlternate}
                shipmentId={shipmentId}
                onSelectAlternate={onSelectAlternate}
              />
            ) : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

/** Keyed by line so the view segment and editor state reset per line. */
function LineDetailContent({
  line,
  memo,
  onSelectAlternate,
  selectedAlternate,
  shipmentId,
}: {
  line: ReviewLineItem;
  memo: (ReviewDocument & { kind: "pdf" }) | null;
  onSelectAlternate?: (value: string | null) => void;
  selectedAlternate?: string | null;
  shipmentId: string;
}) {
  const [view, setView] = useState<"overview" | "trace">("overview");
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
    <>
      <Drawer.CloseTrigger />
      <Drawer.Header className="flex flex-col gap-2.5">
        <div className="flex min-w-0 items-center gap-2 pr-8">
          <Chip className="shrink-0" size="sm" variant="soft">
            <Chip.Label className="tabular-nums">
              Line {line.lineNumber}
            </Chip.Label>
          </Chip>
          <Drawer.Heading className="min-w-0 truncate">
            {line.description}
          </Drawer.Heading>
        </div>
        {line.runId ? (
          <Segment
            selectedKey={view}
            onSelectionChange={(key) =>
              setView(key === "trace" ? "trace" : "overview")
            }
          >
            <Segment.Item id="overview">Overview</Segment.Item>
            <Segment.Item id="trace">
              <IconSparklesThree className="size-3.5" />
              Agent trace
            </Segment.Item>
          </Segment>
        ) : (
          <span className="text-muted text-xs">
            Reused from product memory — no audit run for this line.
          </span>
        )}
      </Drawer.Header>
      {view === "trace" && line.runId ? (
        <Drawer.Body>
          <AgentRunTrace runId={line.runId} />
        </Drawer.Body>
      ) : (
        // The body is a height-constrained scroll container; children must
        // not flex-shrink or the overflow-hidden Widget collapses.
        <Drawer.Body className="flex flex-col gap-4 [&>*]:shrink-0">
          <div className="flex flex-col gap-3">
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
          </div>

          {line.alternates && line.alternates.length > 0 ? (
            <AlternateClassificationsCard
              alternates={line.alternates}
              deltaFor={(value) =>
                line.alternates?.find((alt) => alt.value === value)?.deltaUsd
              }
              selected={selectedAlternate}
              onSelect={onSelectAlternate}
            />
          ) : line.reused ? (
            <span className="text-muted text-xs">
              Reused from product memory — no alternates were scored for this
              line.
            </span>
          ) : null}

          {memo ? (
            <div className="flex flex-col gap-2">
              <span className="text-muted text-xs font-medium">
                Rationale memo
              </span>
              <MemoEditor
                key={memo.name}
                document={memo}
                shipmentId={shipmentId}
              />
            </div>
          ) : null}
        </Drawer.Body>
      )}
    </>
  );
}
