import { IconCircleCheck } from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Button } from "@heroui/react";
import type { DecisionAction, LineCorrection } from "#/lib/review-types";

/**
 * The decision buttons: Request Info (when the review allows it) plus the
 * primary approve, whose label follows the staged decision — a chosen
 * alternate, staged multi-line corrections, or the plain approve label.
 */
export function ReviewActionsBar({
  alternate,
  approveLabel,
  canRequestInfo,
  className,
  correctionEntries,
  isResolving = false,
  multiLine,
  onResolve,
}: {
  alternate: string | null;
  approveLabel: string;
  canRequestInfo?: boolean;
  className?: string;
  correctionEntries: LineCorrection[];
  isResolving?: boolean;
  multiLine: boolean;
  onResolve: (
    action: DecisionAction,
    alternate?: string,
    corrections?: LineCorrection[],
  ) => void;
}) {
  return (
    <div className={`flex items-center justify-end gap-2 ${className ?? ""}`}>
      {canRequestInfo ? (
        <Button
          isDisabled={isResolving}
          variant="ghost"
          onPress={() => onResolve("info-requested")}
        >
          Request Info
        </Button>
      ) : null}
      {multiLine ? (
        <Button
          isPending={isResolving}
          size="lg"
          variant="primary"
          onPress={() =>
            onResolve(
              correctionEntries.length ? "corrected" : "approved",
              undefined,
              correctionEntries.length ? correctionEntries : undefined,
            )
          }
        >
          <IconCircleCheck />
          {correctionEntries.length
            ? `Approve with ${correctionEntries.length} correction${correctionEntries.length === 1 ? "" : "s"}`
            : "Approve all lines"}
        </Button>
      ) : (
        <Button
          isPending={isResolving}
          size="lg"
          variant="primary"
          onPress={() =>
            onResolve(
              alternate ? "corrected" : "approved",
              alternate ?? undefined,
            )
          }
        >
          <IconCircleCheck />
          {alternate ? `Approve ${alternate}` : approveLabel}
        </Button>
      )}
    </div>
  );
}
