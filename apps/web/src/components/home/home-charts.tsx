import { IconCircleInfo } from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Button, Skeleton, Tooltip } from "@heroui/react";
import { AreaChart, BarChart, ChartTooltip, Widget } from "@heroui-pro/react";
import { keepPreviousData } from "@tanstack/react-query";
import { differenceInCalendarDays, format, subDays, subMonths } from "date-fns";
import {
  typeMeta as actionTypeMeta,
  bucketForEvent,
  typeIds,
} from "#/components/autopilot-log";
import { HOME_EVENTS_PARAMS } from "#/components/home/home-params";
import {
  useProductsControllerStats,
  useShipmentEventsControllerFindAll,
} from "#/generated/api";

/* -------------------------------------------------------------------------------------------------
 * Autopilot actions, last 7 days — same buckets and colors as the Logs page
 * -----------------------------------------------------------------------------------------------*/
function ActionsChart() {
  const { data: eventsResponse, isPending } =
    useShipmentEventsControllerFindAll(HOME_EVENTS_PARAMS, {
      query: { placeholderData: keepPreviousData, refetchInterval: 10_000 },
    });

  const dailyActions = Array.from({ length: 7 }, (_, index) => {
    const date = subDays(new Date(), 6 - index);

    return {
      classification: 0,
      day: format(date, "EEE"),
      extraction: 0,
      filing: 0,
      intake: 0,
      offset: 6 - index,
      reconciliation: 0,
      review: 0,
    };
  });

  for (const event of eventsResponse?.data.data ?? []) {
    const offset = differenceInCalendarDays(
      new Date(),
      new Date(event.occurredAt),
    );
    const bucket = dailyActions.find((day) => day.offset === offset);
    if (bucket) bucket[bucketForEvent(event.type, event.payload)] += 1;
  }

  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Autopilot Actions</Widget.Title>
        <span className="text-muted text-xs">Last 7 days</span>
      </Widget.Header>
      <Widget.Content>
        {isPending ? (
          <Skeleton className="h-[220px] rounded-lg" />
        ) : (
          <BarChart data={dailyActions} height={220}>
            <BarChart.Grid vertical={false} />
            <BarChart.XAxis dataKey="day" tickMargin={8} />
            <BarChart.YAxis width={36} />
            {typeIds.map((type, index) => (
              <BarChart.Bar
                key={type}
                dataKey={type}
                fill={actionTypeMeta[type].color}
                name={actionTypeMeta[type].label}
                radius={index === typeIds.length - 1 ? [4, 4, 0, 0] : undefined}
                stackId="actions"
              />
            ))}
            <BarChart.Tooltip
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;

                return (
                  <ChartTooltip>
                    <ChartTooltip.Header>{label}</ChartTooltip.Header>
                    {payload.map((entry) => (
                      <ChartTooltip.Item key={String(entry.dataKey)}>
                        <ChartTooltip.Indicator
                          color={entry.color ?? entry.stroke}
                        />
                        <ChartTooltip.Label>{entry.name}</ChartTooltip.Label>
                        <ChartTooltip.Value>
                          {Number(entry.value).toLocaleString()}
                        </ChartTooltip.Value>
                      </ChartTooltip.Item>
                    ))}
                  </ChartTooltip>
                );
              }}
              cursor={{ fill: "var(--surface-secondary)" }}
            />
          </BarChart>
        )}
      </Widget.Content>
    </Widget>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Catalog growth — cumulative classified products, as on Classification Engine
 * -----------------------------------------------------------------------------------------------*/
function GrowthChart() {
  const { data: response, isPending } = useProductsControllerStats({
    query: { placeholderData: keepPreviousData },
  });
  const growth = response?.data.growth ?? [];
  const growthSeries = [...Array(6)].map((_, index) => {
    const date = subMonths(new Date(), 5 - index);
    const key = format(date, "yyyy-MM");
    const entries = growth
      .filter((point) => point.month <= key)
      .reduce((sum, point) => sum + point.added, 0);

    return { entries, month: format(date, "MMM") };
  });

  return (
    <Widget>
      <Widget.Header>
        <span className="flex items-center gap-1.5">
          <Widget.Title>Catalog Growth</Widget.Title>
          <Tooltip delay={0}>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                aria-label="About catalog growth"
                className="text-muted hover:text-foreground size-5 min-h-5 min-w-5"
                size="sm"
                variant="ghost"
              >
                <IconCircleInfo className="size-3.5" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content className="max-w-60">
              Cumulative products in the classification engine. Grows as
              products are classified; approved codes are reused on future
              shipments.
            </Tooltip.Content>
          </Tooltip>
        </span>
        <span className="text-muted text-xs">
          Cumulative classified products
        </span>
      </Widget.Header>
      <Widget.Content>
        {isPending ? (
          <Skeleton className="h-[220px] rounded-lg" />
        ) : (
          <AreaChart data={growthSeries} height={220}>
            <defs>
              <linearGradient id="home-growth" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-3)"
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-3)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <AreaChart.Grid vertical={false} />
            <AreaChart.XAxis dataKey="month" tickMargin={8} />
            <AreaChart.YAxis allowDecimals={false} width={40} />
            <AreaChart.Area
              dataKey="entries"
              dot={false}
              fill="url(#home-growth)"
              name="Entries"
              stroke="var(--chart-3)"
              strokeWidth={2}
              type="monotone"
            />
            <AreaChart.Tooltip
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;

                return (
                  <ChartTooltip>
                    <ChartTooltip.Header>{label}</ChartTooltip.Header>
                    {payload.map((entry) => (
                      <ChartTooltip.Item key={String(entry.dataKey)}>
                        <ChartTooltip.Indicator
                          color={entry.color ?? entry.stroke}
                        />
                        <ChartTooltip.Label>{entry.name}</ChartTooltip.Label>
                        <ChartTooltip.Value>
                          {Number(entry.value).toLocaleString()}
                        </ChartTooltip.Value>
                      </ChartTooltip.Item>
                    ))}
                  </ChartTooltip>
                );
              }}
            />
          </AreaChart>
        )}
      </Widget.Content>
    </Widget>
  );
}

export function HomeCharts() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ActionsChart />
      <GrowthChart />
    </div>
  );
}
