import { Widget } from "@heroui-pro/react";
import type { ReviewItem } from "#/lib/review-types";

/** When two documents disagree, the side-by-side is decision material. */
export function ComparisonCard({
  comparison,
}: {
  comparison: NonNullable<ReviewItem["comparison"]>;
}) {
  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>What differs between them</Widget.Title>
      </Widget.Header>
      <Widget.Content>
        <div className="grid grid-cols-[minmax(96px,auto)_1fr_1fr] overflow-hidden rounded-lg border text-xs">
          <div className="bg-default/40 p-2.5" />
          <div className="bg-default/40 text-foreground p-2.5 font-medium">
            {comparison.docA}
          </div>
          <div className="bg-default/40 text-foreground p-2.5 font-medium">
            {comparison.docB}
          </div>
          {comparison.rows.map((row) => (
            <div key={row.label} className="contents">
              <div className="text-muted border-t p-2.5">{row.label}</div>
              <div className="text-foreground border-t p-2.5">{row.a}</div>
              <div className="text-foreground border-t p-2.5">{row.b}</div>
            </div>
          ))}
        </div>
      </Widget.Content>
    </Widget>
  );
}
