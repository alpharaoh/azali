import {
  IconCircleCheck,
  IconLaw,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Chip } from "@heroui/react";
import { CitationPill } from "#/components/case-file/citations";
import { ClampedText } from "#/components/clamped-text";
import { ConfidenceChip } from "#/components/confidence-chip";
import type { PgaAgencyDetermination } from "#/lib/review-types";

/** Chip color + label per agency call. */
export const determinationMeta: Record<
  PgaAgencyDetermination["determination"],
  { chip: "danger" | "default" | "warning"; label: string }
> = {
  disclaim: { chip: "warning", label: "Disclaim" },
  not_applicable: { chip: "default", label: "Not applicable" },
  required: { chip: "danger", label: "Filing required" },
};

/** One agency call from a PGA screening: verdict, rationale, data elements,
 * and citations. The line workspace composes these per line. */
export function DeterminationRow({
  determination,
}: {
  determination: PgaAgencyDetermination;
}) {
  const meta = determinationMeta[determination.determination];
  const missing = determination.dataElements.filter(
    (element) => !element.present,
  );
  const present = determination.dataElements.filter(
    (element) => element.present,
  );

  return (
    <div className="flex flex-col gap-2 border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-foreground text-sm font-semibold">
            {determination.agencyName || determination.agencyCode}
          </span>
          {determination.flagCode ? (
            <Chip size="sm" variant="soft">
              <Chip.Label className="font-mono">
                {determination.flagCode}
              </Chip.Label>
            </Chip>
          ) : (
            <Chip color="accent" size="sm" variant="soft">
              <Chip.Label>Jurisdiction sweep</Chip.Label>
            </Chip>
          )}
          {determination.requirement ? (
            <span className="text-muted text-xs">
              {determination.requirement === "required"
                ? "data required"
                : "data may be required"}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ConfidenceChip confidence={determination.confidence} />
          <Chip color={meta.chip} size="sm" variant="soft">
            <Chip.Label>
              {meta.label}
              {determination.determination === "disclaim" &&
              determination.disclaimCode
                ? ` (${determination.disclaimCode})`
                : ""}
            </Chip.Label>
          </Chip>
        </div>
      </div>

      <ClampedText text={determination.rationale} lines={3} />

      {missing.length > 0 ? (
        <div className="border-warning/40 bg-warning/5 flex flex-col gap-1 rounded-lg border border-dashed p-2.5">
          <span className="text-foreground text-xs font-medium">
            Missing data the filing needs
          </span>
          {missing.map((element) => (
            <span key={element.name} className="text-muted text-xs">
              <IconLaw className="text-warning mr-1 inline size-3 align-[-2px]" />
              {element.name} — {element.description}
            </span>
          ))}
        </div>
      ) : null}

      {present.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {present.map((element) => (
            <span key={element.name} className="text-muted text-xs">
              <IconCircleCheck className="text-success mr-1 inline size-3 align-[-2px]" />
              {element.name}
              {element.sourceDocument ? ` · ${element.sourceDocument}` : ""}
            </span>
          ))}
        </div>
      ) : null}

      {determination.citations.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted text-xs">Based on</span>
          {determination.citations.slice(0, 3).map((citation) => (
            <CitationPill key={citation.ref} citation={citation} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Stable render key for a determination row. */
export function determinationKey(determination: PgaAgencyDetermination) {
  return `${determination.lineItemId}:${determination.agencyCode}:${determination.flagCode ?? "sweep"}`;
}
