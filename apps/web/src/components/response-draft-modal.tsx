import {
  IconArrowRedoDown,
  IconArrowUndoUp,
  IconBold,
  IconBulletList,
  IconCloseQuote1,
  IconH2,
  IconH3,
  IconItalic,
  IconNumberedList,
  IconStrikeThrough,
  IconUnderline,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Button, Modal, toast } from "@heroui/react";
import { RichTextEditor } from "@heroui-pro/react";
import { useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/core";
import { useRef, useState } from "react";

import {
  getShipmentEventsControllerFindByShipmentQueryKey,
  useShipmentEventsControllerCreate,
} from "#/generated/api";
import type { ReviewDocument } from "#/lib/review-types";

/**
 * Edit an agent-drafted document (e.g. the CF-28 response letter) in a rich
 * text editor. Saving appends a revision to the shipment's event stream —
 * the file stays append-only, so every draft the broker touched is on record.
 */
export function ResponseDraftModal({
  document,
  isOpen,
  onOpenChange,
  readOnly = false,
  shipmentId,
}: {
  document: (ReviewDocument & { kind: "pdf" }) | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** View-only (e.g. the classification rationale memo) — no revisions. */
  readOnly?: boolean;
  shipmentId: string;
}) {
  const queryClient = useQueryClient();
  const createEvent = useShipmentEventsControllerCreate();
  const [isSaving, setIsSaving] = useState(false);
  // The latest editor state, captured without re-rendering per keystroke.
  const latest = useRef<{ draft: JSONContent; words: number } | null>(null);

  const handleSave = () => {
    if (!document) return;

    const revision = latest.current;
    const run = createEvent
      .mutateAsync({
        shipmentId,
        data: {
          type: "response_drafted",
          actor: "user",
          title: "CF-28 response draft revised",
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
        error: "Failed to save the draft",
        loading: "Saving draft to the file...",
        success: "Draft revision saved to the file",
      },
    );

    run
      .then(() => onOpenChange(false))
      .catch(() => {
        // The toast reports the failure; keep the editor open.
      });
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="max-w-full sm:w-[60vw]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{document?.name ?? "Draft"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="min-h-0">
              {document ? (
                <RichTextEditor
                  defaultValue={document.draft as JSONContent}
                  isReadOnly={readOnly}
                  onValueChange={(value, details) => {
                    latest.current = { draft: value, words: details.wordCount };
                  }}
                >
                  <RichTextEditor.Shell>
                    <RichTextEditor.Toolbar aria-label="Formatting">
                      <RichTextEditor.ToolbarGroup>
                        <RichTextEditor.ActionButton
                          action="undo"
                          tooltip="Undo"
                        >
                          <IconArrowUndoUp className="size-3.5" />
                        </RichTextEditor.ActionButton>
                        <RichTextEditor.ActionButton
                          action="redo"
                          tooltip="Redo"
                        >
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
                        <RichTextEditor.ToggleButton
                          command="bold"
                          tooltip="Bold"
                        >
                          <IconBold className="size-3.5" />
                        </RichTextEditor.ToggleButton>
                        <RichTextEditor.ToggleButton
                          command="italic"
                          tooltip="Italic"
                        >
                          <IconItalic className="size-3.5" />
                        </RichTextEditor.ToggleButton>
                        <RichTextEditor.ToggleButton
                          command="underline"
                          tooltip="Underline"
                        >
                          <IconUnderline className="size-3.5" />
                        </RichTextEditor.ToggleButton>
                        <RichTextEditor.ToggleButton
                          command="strike"
                          tooltip="Strikethrough"
                        >
                          <IconStrikeThrough className="size-3.5" />
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
                        <RichTextEditor.ToggleButton
                          command="blockquote"
                          tooltip="Blockquote"
                        >
                          <IconCloseQuote1 className="size-3.5" />
                        </RichTextEditor.ToggleButton>
                      </RichTextEditor.ToolbarGroup>
                    </RichTextEditor.Toolbar>
                    <RichTextEditor.Content className="h-[64dvh] overflow-y-auto" />
                    <RichTextEditor.BubbleMenu>
                      <RichTextEditor.ToggleButton
                        command="bold"
                        tooltip="Bold"
                      >
                        <IconBold className="size-3.5" />
                      </RichTextEditor.ToggleButton>
                      <RichTextEditor.ToggleButton
                        command="italic"
                        tooltip="Italic"
                      >
                        <IconItalic className="size-3.5" />
                      </RichTextEditor.ToggleButton>
                      <RichTextEditor.ToggleButton
                        command="underline"
                        tooltip="Underline"
                      >
                        <IconUnderline className="size-3.5" />
                      </RichTextEditor.ToggleButton>
                    </RichTextEditor.BubbleMenu>
                    <RichTextEditor.Footer>
                      <span className="text-muted text-xs">
                        {readOnly
                          ? "Written at entry — part of the audit record"
                          : "Saving appends a revision to the audit record"}
                      </span>
                      <RichTextEditor.CharacterCount showWords />
                    </RichTextEditor.Footer>
                  </RichTextEditor.Shell>
                </RichTextEditor>
              ) : null}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline" onPress={() => onOpenChange(false)}>
                {readOnly ? "Close" : "Cancel"}
              </Button>
              {!readOnly && (
                <Button
                  isPending={isSaving}
                  variant="primary"
                  onPress={handleSave}
                >
                  Save to file
                </Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
