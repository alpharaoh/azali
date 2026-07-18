import {
  IconAirplane,
  IconShip,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Widget } from "@heroui-pro/react";
import { addHours, formatDistanceToNowStrict } from "date-fns";
import type { ReactNode } from "react";
import { getCountryFlag } from "#/lib/country-flag";
import type { ShipmentFacts } from "#/lib/review-types";

/* -------------------------------------------------------------------------------------------------
 * Shipment facts — the same facts in two shapes: an inline strip for the
 * review workspace, and a one-fact-per-row card for the detail page's
 * information column.
 * -----------------------------------------------------------------------------------------------*/

/** Ship for ocean/sea freight, plane for air; nothing for unknown modes. */
function modeIcon(transportMode: string) {
  const mode = transportMode.toLowerCase();

  if (mode === "air") return <IconAirplane className="text-muted size-3.5" />;
  if (mode === "ocean" || mode === "sea")
    return <IconShip className="text-muted size-3.5" />;

  return null;
}

interface FactEntry {
  label: string;
  value: string;
  /** Optional glyph (flag, mode icon) shown just before the value. */
  leading?: ReactNode;
}

function factEntries(shipment: ShipmentFacts): FactEntry[] {
  const Flag = shipment.originCountry
    ? getCountryFlag(shipment.originCountry)
    : undefined;

  return [
    {
      label: "Origin",
      leading: Flag ? <Flag className="h-3 w-4 shrink-0 rounded-sm" /> : null,
      value: shipment.origin,
    },
    { label: "Port", value: shipment.port },
    {
      label: "Arrives",
      value:
        shipment.arrivesInHours === null
          ? "—"
          : formatDistanceToNowStrict(
              addHours(new Date(), shipment.arrivesInHours),
              { addSuffix: true },
            ),
    },
    {
      label: "Mode",
      leading: modeIcon(shipment.transportMode),
      value: shipment.mode,
    },
    ...(shipment.conveyance
      ? [{ label: "Conveyance", value: shipment.conveyance }]
      : []),
    { label: "Incoterm", value: shipment.incoterm },
    { label: "Entry", value: shipment.entryType },
  ];
}

/** One scannable inline strip — label·value pairs wrapping as one row. */
export function ShipmentFactsStrip({ shipment }: { shipment: ShipmentFacts }) {
  return (
    <Widget>
      <Widget.Content className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
        {factEntries(shipment).map((fact) => (
          <div key={fact.label} className="flex min-w-0 items-baseline gap-1.5">
            <span className="text-muted text-xs">{fact.label}</span>
            <span className="text-foreground flex min-w-0 items-center gap-1 truncate text-sm font-medium">
              {fact.leading}
              {fact.value}
            </span>
          </div>
        ))}
      </Widget.Content>
    </Widget>
  );
}

/** The same facts stacked — one fact per row, label left, value right. */
export function ShipmentFactsCard({ shipment }: { shipment: ShipmentFacts }) {
  return (
    <Widget className="min-w-0">
      <Widget.Header>
        <Widget.Title>Shipment</Widget.Title>
      </Widget.Header>
      <Widget.Content className="gap-0">
        {factEntries(shipment).map((fact) => (
          <div
            key={fact.label}
            className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0 last:pb-0"
          >
            <span className="text-muted shrink-0 text-xs">{fact.label}</span>
            <span className="text-foreground flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
              {fact.leading}
              {fact.value}
            </span>
          </div>
        ))}
      </Widget.Content>
    </Widget>
  );
}
