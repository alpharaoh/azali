import {
  IconCircleCheck,
  IconShieldBreak,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Chip } from "@heroui/react";
import { Widget } from "@heroui-pro/react";
import { CitationPill } from "#/components/case-file/citations";
import { ClampedText } from "#/components/clamped-text";
import { ConfidenceChip } from "#/components/confidence-chip";
import type { PgaAgencyDetermination, ReviewItem } from "#/lib/review-types";

const determinationMeta: Record<
  PgaAgencyDetermination["determination"],
  { chip: "danger" | "default" | "warning"; label: string }
> = {
  disclaim: { chip: "warning", label: "Disclaim" },
  not_applicable: { chip: "default", label: "Not applicable" },
  required: { chip: "danger", label: "Filing required" },
};

function DeterminationRow({
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

      <ClampedText text={determination.rationale} />

      {missing.length > 0 ? (
        <div className="border-warning/40 bg-warning/5 flex flex-col gap-1 rounded-lg border border-dashed p-2.5">
          <span className="text-foreground text-xs font-medium">
            Missing data the filing needs
          </span>
          {missing.map((element) => (
            <span key={element.name} className="text-muted text-xs">
              <IconShieldBreak className="text-warning mr-1 inline size-3 align-[-2px]" />
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

/**
 * The PGA review's decision card: every agency determination the screening
 * proposed, grouped by shipment line, with the flag-table publication the
 * screening cited (the reasonable-care anchor) in the footer.
 */
export function PgaDeterminationsCard({
  agencies,
  flagTableVersion,
}: {
  agencies: PgaAgencyDetermination[];
  flagTableVersion?: ReviewItem["flagTableVersion"];
}) {
  const byLine = new Map<number, PgaAgencyDetermination[]>();
  for (const agency of agencies) {
    const existing = byLine.get(agency.lineNumber) ?? [];
    byLine.set(agency.lineNumber, [...existing, agency]);
  }
  const lines = [...byLine.entries()].sort(([a], [b]) => a - b);
  const multiLine = lines.length > 1;

  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Agency determinations</Widget.Title>
      </Widget.Header>
      <Widget.Content className="flex flex-col gap-1">
        {lines.map(([lineNumber, determinations]) => (
          <div key={lineNumber} className="flex flex-col">
            {multiLine ? (
              <div className="flex items-baseline gap-2 pt-2">
                <span className="text-muted shrink-0 text-xs tabular-nums">
                  #{lineNumber}
                </span>
                <span className="text-muted truncate text-xs">
                  {determinations[0]?.lineDescription}
                </span>
              </div>
            ) : null}
            {determinations.map((determination) => (
              <DeterminationRow
                key={`${determination.lineItemId}:${determination.agencyCode}:${determination.flagCode ?? "sweep"}`}
                determination={determination}
              />
            ))}
          </div>
        ))}
        {flagTableVersion ? (
          <span className="text-muted pt-2 text-xs">
            Screened against ACE Agency Tariff Code Reference{" "}
            {flagTableVersion.pubNumber} (
            {flagTableVersion.publishedAt.slice(0, 10)})
          </span>
        ) : null}
      </Widget.Content>
    </Widget>
  );
}
