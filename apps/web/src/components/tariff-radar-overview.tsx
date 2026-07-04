import {
  Calendar,
  ChevronRight,
  CircleFill,
  CircleInfo,
} from "@gravity-ui/icons";
import { Button, Chip, Separator, Tooltip } from "@heroui/react";
import { Kanban, TrendChip, Widget } from "@heroui-pro/react";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { useMemo } from "react";

/* -------------------------------------------------------------------------------------------------
 * Types & Data
 * -----------------------------------------------------------------------------------------------*/
interface TariffEventSeed {
  id: number;
  /** Plain-English headline — what a human would say is happening. */
  title: string;
  /** Regulatory citation and technical detail — shown in the View drill-down. */
  description: string;
  /** Days relative to today the change takes effect; negative = already in effect. */
  daysFromNow: number;
  skus: number;
  clients: number;
  /** Dollar impact on clients, with a caption explaining what the number means. */
  impact: string;
  impactCaption: string;
  impactTone: "negative" | "neutral" | "positive";
}

interface TariffEvent extends TariffEventSeed {
  effectiveDate: Date;
  /** Days until effective; null = already in effect. */
  daysOut: number | null;
}

const overviewStats: Array<{
  change: string;
  title: string;
  trend: "neutral" | "up";
  value: string;
  info?: string;
}> = [
  {
    change: "+2",
    title: "Changes on Radar",
    trend: "neutral",
    value: "5",
  },
  {
    change: "+214",
    title: "Products Affected",
    trend: "neutral",
    value: "420",
  },
  {
    change: "+$113K",
    title: "Client Duty Impact",
    trend: "neutral",
    value: "+$325K/yr",
  },
  {
    change: "+$17K",
    info: "Estimated fees your brokerage could earn by acting on these changes — exclusion renewal filings, contingency fees on refund claims, and reclassification work.",
    title: "Est. Fee Opportunity",
    trend: "up",
    value: "$52K",
  },
];

const eventSeeds: TariffEventSeed[] = [
  {
    clients: 6,
    daysFromNow: 23,
    description:
      "USTR Section 301, List 4B — 87 HTS subheadings in Chapters 84, 85 & 94.",
    id: 1,
    impact: "+$212K/yr",
    impactCaption: "added duty for clients",
    impactTone: "negative",
    skus: 214,
    title: "Duty on consumer electronics is rising from 7.5% to 25%",
  },
  {
    clients: 1,
    daysFromNow: 29,
    description:
      "Section 301 exclusion on HTS 8517.62.00 — duty reverts to 25% when it lapses.",
    id: 2,
    impact: "+$84K/yr",
    impactCaption: "added duty if not renewed",
    impactTone: "negative",
    skus: 9,
    title: "Bluewave's network equipment exemption is about to lapse",
  },
  {
    clients: 3,
    daysFromNow: 43,
    description:
      "Section 232 derivatives expansion — fabricated aluminum components.",
    id: 3,
    impact: "+$67K/yr",
    impactCaption: "added duty for clients",
    impactTone: "negative",
    skus: 48,
    title: "Steel & aluminum tariffs now cover fabricated aluminum parts",
  },
  {
    clients: 4,
    daysFromNow: -1,
    description:
      "HTS mid-year revision — heading 6404 split by upper material.",
    id: 4,
    impact: "$0",
    impactCaption: "no duty change, codes only",
    impactTone: "neutral",
    skus: 132,
    title: "Footwear classification codes were reorganized",
  },
  {
    clients: 2,
    daysFromNow: -12,
    description:
      "Section 301 exclusion granted on HTS 9403.20.00 — retroactive to April.",
    id: 5,
    impact: "−$38K/yr",
    impactCaption: "savings for clients",
    impactTone: "positive",
    skus: 17,
    title: "New exemption granted — furniture clients get money back",
  },
];

const columns: Array<{
  title: string;
  indicatorClass: string;
  filter: (event: TariffEvent) => boolean;
}> = [
  {
    filter: (event) => event.daysOut !== null && event.daysOut <= 30,
    indicatorClass: "bg-danger",
    title: "Next 30 days",
  },
  {
    filter: (event) => event.daysOut !== null && event.daysOut > 30,
    indicatorClass: "bg-warning",
    title: "Next 90 days",
  },
  {
    filter: (event) => event.daysOut === null,
    indicatorClass: "bg-success",
    title: "Recently took effect",
  },
];

const impactToneClass = {
  negative: "text-danger",
  neutral: "text-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
} as const;

/* -------------------------------------------------------------------------------------------------
 * Time-left chip
 * -----------------------------------------------------------------------------------------------*/
function TimeLeftChip({ daysOut }: { daysOut: number | null }) {
  if (daysOut === null) {
    return (
      <Chip color="success" size="sm" variant="soft">
        <CircleFill width={6} />
        <Chip.Label>In effect</Chip.Label>
      </Chip>
    );
  }

  return (
    <Chip color={daysOut <= 30 ? "danger" : "default"} size="sm" variant="soft">
      <Chip.Label>
        {daysOut} {daysOut === 1 ? "day" : "days"} left
      </Chip.Label>
    </Chip>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Event card — time left → title → stats → footer
 * -----------------------------------------------------------------------------------------------*/
function TariffEventCard({ event }: { event: TariffEvent }) {
  return (
    <Kanban.Card
      className="cursor-auto select-text"
      id={event.id}
      textValue={event.title}
    >
      <div className="flex w-full flex-col gap-3 p-1">
        <div>
          <TimeLeftChip daysOut={event.daysOut} />
        </div>

        <span className="text-foreground text-sm font-semibold leading-snug">
          {event.title}
        </span>

        <div className="flex items-center gap-3 py-1">
          <div className="flex flex-1 flex-col">
            <span
              className={`text-lg font-semibold tabular-nums tracking-tight ${impactToneClass[event.impactTone]}`}
            >
              {event.impact}
            </span>
            <span className="text-muted text-xs">{event.impactCaption}</span>
          </div>
          <Separator className="!h-8" orientation="vertical" />
          <div className="flex flex-1 flex-col">
            <span className="text-foreground text-lg font-semibold tabular-nums tracking-tight">
              {event.skus}
            </span>
            <span className="text-muted text-xs">
              products · {event.clients}{" "}
              {event.clients === 1 ? "client" : "clients"}
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-muted inline-flex items-center gap-1.5 text-xs">
            <Calendar className="size-3.5 shrink-0" />
            Effective {format(event.effectiveDate, "MMM d, yyyy")}
          </span>
          <Button size="sm" variant="outline">
            Open
            <ChevronRight />
          </Button>
        </div>
      </div>
    </Kanban.Card>
  );
}

/* -------------------------------------------------------------------------------------------------
 * TariffRadarOverview
 * -----------------------------------------------------------------------------------------------*/
export function TariffRadarOverview() {
  const events = useMemo<TariffEvent[]>(() => {
    const now = new Date();

    return eventSeeds.map((seed) => {
      const effectiveDate = addDays(now, seed.daysFromNow);
      const days = differenceInCalendarDays(effectiveDate, now);

      return { ...seed, daysOut: days > 0 ? days : null, effectiveDate };
    });
  }, []);

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-foreground text-xl font-semibold">Tariff Radar</h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          When tariff rules change, we already know which client products are
          hit and what it costs them — before it takes effect. The AI re-files
          what it can and queues the rest for review.
        </p>
      </div>

      {/* Overview KPIs */}
      <Widget>
        <Widget.Header>
          <Widget.Title>Overview</Widget.Title>
        </Widget.Header>
        <Widget.Content className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {overviewStats.map((card) => (
            <div key={card.title} className="flex flex-col gap-1">
              <span className="text-muted inline-flex items-center gap-1 text-sm font-medium">
                {card.title}
                {card.info ? (
                  <Tooltip>
                    <Button
                      isIconOnly
                      aria-label={`About ${card.title}`}
                      className="text-muted hover:text-foreground size-5 min-h-5 min-w-5"
                      size="sm"
                      variant="ghost"
                    >
                      <CircleInfo className="size-3.5" />
                    </Button>
                    <Tooltip.Content className="max-w-64">
                      {card.info}
                    </Tooltip.Content>
                  </Tooltip>
                ) : null}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-foreground text-2xl font-semibold tracking-tight">
                  {card.value}
                </span>
                <TrendChip trend={card.trend} variant="soft">
                  {card.change}
                </TrendChip>
              </div>
            </div>
          ))}
        </Widget.Content>
      </Widget>

      {/* Time-bucketed board */}
      <Kanban size="lg">
        {columns.map((column) => {
          const columnEvents = events.filter(column.filter);

          return (
            <Kanban.Column key={column.title}>
              <Kanban.ColumnHeader>
                <Kanban.ColumnIndicator className={column.indicatorClass} />
                <Kanban.ColumnTitle>{column.title}</Kanban.ColumnTitle>
                <Kanban.ColumnCount>{columnEvents.length}</Kanban.ColumnCount>
              </Kanban.ColumnHeader>
              <Kanban.ColumnBody>
                <Kanban.CardList aria-label={column.title} items={columnEvents}>
                  {(event) => <TariffEventCard event={event} />}
                </Kanban.CardList>
              </Kanban.ColumnBody>
            </Kanban.Column>
          );
        })}
      </Kanban>
    </div>
  );
}
