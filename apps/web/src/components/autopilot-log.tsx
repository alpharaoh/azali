import {
  IconArrowInbox,
  IconArrowOutOfBox,
  IconArrowRotateRightLeft,
  IconCircleInfo,
  IconFileText,
  IconFilter1,
  IconFlag1,
  IconSquareArrowTopRight,
  IconTag,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import {
  Button,
  Chip,
  Dropdown,
  Label,
  ListBox,
  Pagination,
  SearchField,
  Separator,
  Tooltip,
} from "@heroui/react";
import type { DataGridColumn } from "@heroui-pro/react";
import {
  BarChart,
  ChartTooltip,
  DataGrid,
  InlineSelect,
  PieChart,
  Widget,
} from "@heroui-pro/react";
import { keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  subDays,
} from "date-fns";
import type { ComponentType } from "react";
import { useState } from "react";
import type { SortDescriptor } from "react-aria-components";
import { TableFetchingState, TableSkeleton } from "#/components/table-loading";
import {
  useShipmentEventsControllerFindAll,
  useShipmentsControllerFindAll,
} from "#/generated/api";
import { ROWS_PER_PAGE_OPTIONS, useRowsPerPage } from "#/lib/use-rows-per-page";

/* -------------------------------------------------------------------------------------------------
 * Meta
 * -----------------------------------------------------------------------------------------------*/
type AutopilotActionType =
  | "intake"
  | "extraction"
  | "classification"
  | "reconciliation"
  | "filing"
  | "review";

interface Row {
  id: string;
  shipmentId: string;
  type: AutopilotActionType;
  title: string;
  client: string;
  reference: string;
  confidence?: number;
  occurredAt: Date;
}

const typeMeta: Record<
  AutopilotActionType,
  {
    color: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  intake: { color: "var(--chart-1)", icon: IconArrowInbox, label: "Intake" },
  extraction: {
    color: "var(--chart-2)",
    icon: IconFileText,
    label: "Extraction",
  },
  classification: {
    color: "var(--chart-3)",
    icon: IconTag,
    label: "Classification",
  },
  reconciliation: {
    color: "var(--chart-4)",
    icon: IconArrowRotateRightLeft,
    label: "Reconciliation",
  },
  filing: {
    color: "var(--chart-5)",
    icon: IconArrowOutOfBox,
    label: "Filing",
  },
  review: { color: "var(--warning)", icon: IconFlag1, label: "Review" },
};

const typeIds = Object.keys(typeMeta) as AutopilotActionType[];

/** Known event types, mapped to the six action families shown in the charts. */
const EVENT_TYPE_BUCKET: Record<string, AutopilotActionType> = {
  activity: "intake",
  cbp_response_received: "filing",
  classification: "classification",
  classification_failed: "review",
  classification_memo_drafted: "classification",
  classification_proposed: "classification",
  classification_reused: "classification",
  document_extracted: "extraction",
  document_received: "intake",
  documents_compared: "extraction",
  duty_calculated: "reconciliation",
  duty_reconciled: "reconciliation",
  email_received: "intake",
  email_sent: "filing",
  enforcement: "review",
  entry_drafted: "filing",
  entry_filed: "filing",
  hts_lookup: "classification",
  ingest_failed: "review",
  invoice_received: "intake",
  market_comparison: "reconciliation",
  pga: "classification",
  review_requested: "review",
  review_resolved: "review",
  scan_received: "intake",
  section_301_check: "classification",
  shipment_facts_extracted: "extraction",
  signoff: "review",
  tariff_change_detected: "classification",
  totals_reconciled: "reconciliation",
  valuation: "reconciliation",
  vector_search: "classification",
};

/** Heuristic fallback for event types the explicit map doesn't know yet. */
function bucketFor(eventType: string): AutopilotActionType {
  if (/classif|hts|tariff|section|vector/.test(eventType))
    return "classification";
  if (/extract|scan|ocr|compar/.test(eventType)) return "extraction";
  if (/reconcil|duty|totals|valuat/.test(eventType)) return "reconciliation";
  if (/entry|fil|draft|response|sent/.test(eventType)) return "filing";
  if (/review|fail|flag|signoff/.test(eventType)) return "review";
  return "intake";
}

/** agent_trace events carry their step kind in the payload. */
const TRACE_KIND_BUCKET: Record<string, AutopilotActionType> = {
  calc: "reconciliation",
  check: "classification",
  decision: "filing",
  flag: "review",
  lookup: "classification",
  read: "extraction",
};

function bucketForEvent(
  eventType: string,
  payload: Record<string, unknown>,
): AutopilotActionType {
  if (eventType === "agent_trace") {
    const kind = typeof payload.kind === "string" ? payload.kind : "";

    return TRACE_KIND_BUCKET[kind] ?? "classification";
  }

  return EVENT_TYPE_BUCKET[eventType] ?? bucketFor(eventType);
}

function occurredAgo(date: Date) {
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

/* -------------------------------------------------------------------------------------------------
 * Actions table
 * -----------------------------------------------------------------------------------------------*/
const actionColumns: DataGridColumn<Row>[] = [
  {
    accessorKey: "title",
    cell: (action) => {
      const Icon = typeMeta[action.type].icon;

      return (
        <div className="flex min-w-0 items-start gap-2.5">
          <Icon className="text-muted mt-0.5 size-4 shrink-0" />
          <span className="text-foreground truncate text-sm font-medium">
            {action.title}
          </span>
        </div>
      );
    },
    header: "Action",
    id: "title",
    isRowHeader: true,
    maxWidth: 340,
    minWidth: 280,
    width: 340,
  },
  {
    accessorKey: "type",
    allowsSorting: true,
    cell: (action) => (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: typeMeta[action.type].color }}
        />
        {typeMeta[action.type].label}
      </span>
    ),
    header: "Type",
    id: "type",
    minWidth: 140,
  },
  {
    accessorKey: "client",
    allowsSorting: true,
    cell: (action) => (
      <span className="block min-w-0 truncate text-sm">
        {action.client}
        <span className="text-muted tabular-nums"> · {action.reference}</span>
      </span>
    ),
    header: "Client",
    id: "client",
    maxWidth: 240,
    minWidth: 180,
    width: 240,
  },
  {
    accessorKey: "confidence",
    allowsSorting: true,
    cell: (action) =>
      action.confidence === undefined ? (
        <span className="text-muted text-sm">—</span>
      ) : (
        <Chip
          color={action.confidence >= 0.95 ? "success" : "warning"}
          size="sm"
          variant="soft"
        >
          <Chip.Label className="tabular-nums">
            {Math.round(action.confidence * 100)}%
          </Chip.Label>
        </Chip>
      ),
    header: "Confidence",
    id: "confidence",
    minWidth: 110,
  },
  {
    accessorKey: "occurredAt",
    allowsSorting: true,
    cell: (action) => (
      <span className="text-muted whitespace-nowrap text-sm">
        {occurredAgo(action.occurredAt)}
      </span>
    ),
    header: "When",
    id: "when",
    minWidth: 120,
  },
  {
    align: "end",
    cell: (action) => <ActionRowButtons shipmentId={action.shipmentId} />,
    header: "",
    id: "actions",
    minWidth: 90,
    pinned: "end",
  },
];

function ActionRowButtons({ shipmentId }: { shipmentId: string }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <Button
          isIconOnly
          aria-label="View shipment"
          className="text-muted hover:text-foreground"
          size="sm"
          variant="ghost"
          onPress={() =>
            navigate({
              params: { shipmentId },
              to: "/dashboard/shipments/$shipmentId",
            })
          }
        >
          <IconSquareArrowTopRight className="size-3.5" />
        </Button>
        <Tooltip.Content>View shipment</Tooltip.Content>
      </Tooltip>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * AutopilotLog
 * -----------------------------------------------------------------------------------------------*/
export function AutopilotLog() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useRowsPerPage();
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "when",
    direction: "ascending",
  });

  const {
    data: eventsResponse,
    isFetching,
    isPending,
  } = useShipmentEventsControllerFindAll(
    { actor: ["ai"], limit: 200 },
    { query: { placeholderData: keepPreviousData } },
  );
  const { data: shipmentsResponse } = useShipmentsControllerFindAll(
    { limit: 100 },
    { query: { placeholderData: keepPreviousData } },
  );
  const shipmentById = new Map<
    string,
    { clientName?: string; reference: string }
  >();

  for (const shipment of shipmentsResponse?.data.data ?? []) {
    shipmentById.set(shipment.id, {
      clientName: shipment.client?.name,
      reference: shipment.reference,
    });
  }

  const actions: Row[] = (eventsResponse?.data.data ?? []).map((event) => {
    const shipment = shipmentById.get(event.shipmentId);
    const confidence = (event.payload as { confidence?: number }).confidence;

    return {
      id: event.id,
      shipmentId: event.shipmentId,
      type: bucketForEvent(event.type, event.payload),
      title: event.title,
      client: shipment?.clientName ?? "Unknown client",
      reference: shipment?.reference ?? "—",
      confidence,
      occurredAt: new Date(event.occurredAt),
    };
  });

  const now = Date.now();
  const today = actions.filter(
    (action) => now - action.occurredAt.getTime() < 24 * 3_600_000,
  ).length;
  const filed = actions.filter((action) => action.type === "filing").length;
  const withConfidence = actions.filter(
    (action) => action.confidence !== undefined,
  );
  const avgConfidence = withConfidence.length
    ? withConfidence.reduce(
        (sum, action) => sum + (action.confidence ?? 0),
        0,
      ) / withConfidence.length
    : 0;

  const shipments = shipmentsResponse?.data.data ?? [];
  const autoRate = shipments.length
    ? 1 -
      shipments.filter((shipment) => shipment.status === "needs_review")
        .length /
        shipments.length
    : 0;

  const overviewStats = [
    { title: "Actions (24h)", value: String(today) },
    {
      info: "Share of shipments moving without a human touch. The rest are in the Review Queue.",
      title: "Auto-Handled Rate",
      value: `${(autoRate * 100).toFixed(1)}%`,
    },
    { title: "Filing Actions", value: String(filed) },
    {
      info: "Average model confidence across autonomous actions that report one.",
      title: "Avg Confidence",
      value: `${(avgConfidence * 100).toFixed(1)}%`,
    },
  ];

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

  for (const action of actions) {
    const offset = differenceInCalendarDays(new Date(), action.occurredAt);
    const bucket = dailyActions.find((day) => day.offset === offset);
    if (bucket) bucket[action.type] += 1;
  }

  const weeklyByType = typeIds.map((type) => ({
    color: typeMeta[type].color,
    name: typeMeta[type].label,
    value: actions.filter((action) => action.type === type).length,
  }));

  const query = search.trim().toLowerCase();
  const filteredActions = actions.filter(
    (action) =>
      (typeFilter.size === 0 || typeFilter.has(action.type)) &&
      (query.length === 0 ||
        action.title.toLowerCase().includes(query) ||
        action.client.toLowerCase().includes(query) ||
        action.reference.toLowerCase().includes(query)),
  );

  const visibleActions = [...filteredActions].sort((a, b) => {
    const col = sortDescriptor.column as string;
    let cmp: number;

    if (col === "when") {
      cmp = b.occurredAt.getTime() - a.occurredAt.getTime();
    } else if (col === "confidence") {
      cmp = (a.confidence ?? 0) - (b.confidence ?? 0);
    } else if (col === "type") {
      cmp = a.type.localeCompare(b.type);
    } else {
      cmp = a.client.localeCompare(b.client);
    }

    if (sortDescriptor.direction === "descending") cmp *= -1;

    return cmp;
  });

  const totalPages = Math.ceil(visibleActions.length / rowsPerPage) || 1;
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * rowsPerPage;
  const paginatedActions = visibleActions.slice(
    pageStart,
    pageStart + rowsPerPage,
  );

  const paginationPages: Array<{ key: string; value: number | "ellipsis" }> =
    [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++)
      paginationPages.push({ key: `p-${i}`, value: i });
  } else {
    paginationPages.push({ key: "p-1", value: 1 });
    if (safePage > 3)
      paginationPages.push({ key: "e-start", value: "ellipsis" });
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);

    for (let i = start; i <= end; i++)
      paginationPages.push({ key: `p-${i}`, value: i });
    if (safePage < totalPages - 2)
      paginationPages.push({ key: "e-end", value: "ellipsis" });
    paginationPages.push({ key: `p-${totalPages}`, value: totalPages });
  }

  const rangeStart = (safePage - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(safePage * rowsPerPage, visibleActions.length);

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-foreground text-xl font-semibold">Autopilot Log</h1>
        <p className="text-muted mt-1 max-w-3xl text-sm">
          Everything the AI did without human intervention — spot-check it,
          build trust, and use the accuracy to raise the autonomy threshold.
        </p>
      </div>

      {/* Overview */}
      <Widget>
        <Widget.Header>
          <Widget.Title>Overview</Widget.Title>
        </Widget.Header>
        <Widget.Content className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {overviewStats.map((stat) => (
            <div key={stat.title} className="flex flex-col gap-1">
              <span className="text-muted inline-flex items-center gap-1 text-sm font-medium">
                {stat.title}
                {stat.info ? (
                  <Tooltip>
                    <Button
                      isIconOnly
                      aria-label={`About ${stat.title}`}
                      className="text-muted hover:text-foreground size-5 min-h-5 min-w-5"
                      size="sm"
                      variant="ghost"
                    >
                      <IconCircleInfo className="size-3.5" />
                    </Button>
                    <Tooltip.Content className="max-w-64">
                      {stat.info}
                    </Tooltip.Content>
                  </Tooltip>
                ) : null}
              </span>
              <span className="text-foreground text-2xl font-semibold tabular-nums tracking-tight">
                {stat.value}
              </span>
            </div>
          ))}
        </Widget.Content>
      </Widget>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Widget className="lg:col-span-2">
          <Widget.Header>
            <Widget.Title>Autonomous Actions</Widget.Title>
            <Widget.Legend>
              {typeIds.map((type) => (
                <Widget.LegendItem key={type} color={typeMeta[type].color}>
                  {typeMeta[type].label}
                </Widget.LegendItem>
              ))}
            </Widget.Legend>
          </Widget.Header>
          <Widget.Content>
            <BarChart data={dailyActions} height={220}>
              <BarChart.Grid vertical={false} />
              <BarChart.XAxis dataKey="day" tickMargin={8} />
              <BarChart.YAxis width={36} />
              {typeIds.map((type, index) => (
                <BarChart.Bar
                  key={type}
                  dataKey={type}
                  fill={typeMeta[type].color}
                  name={typeMeta[type].label}
                  radius={
                    index === typeIds.length - 1 ? [4, 4, 0, 0] : undefined
                  }
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
          </Widget.Content>
        </Widget>

        <Widget>
          <Widget.Header>
            <Widget.Title>This Week by Type</Widget.Title>
          </Widget.Header>
          <Widget.Content>
            <PieChart height={200}>
              <PieChart.Pie
                data={weeklyByType}
                dataKey="value"
                innerRadius={55}
                nameKey="name"
                outerRadius={80}
                strokeWidth={0}
              >
                {weeklyByType.map((entry) => (
                  <PieChart.Cell key={entry.name} fill={entry.color} />
                ))}
              </PieChart.Pie>
              <PieChart.Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;

                  return (
                    <ChartTooltip>
                      {payload.map((entry) => (
                        <ChartTooltip.Item key={String(entry.name)}>
                          <ChartTooltip.Indicator
                            color={(entry.payload as { color?: string })?.color}
                          />
                          <ChartTooltip.Label>
                            {String(entry.name)}
                          </ChartTooltip.Label>
                          <ChartTooltip.Value>
                            {Number(entry.value).toLocaleString()}
                          </ChartTooltip.Value>
                        </ChartTooltip.Item>
                      ))}
                    </ChartTooltip>
                  );
                }}
              />
            </PieChart>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {weeklyByType.map((entry) => (
                <span
                  key={entry.name}
                  className="text-muted inline-flex items-center gap-1.5 text-xs"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.name}
                  <span className="text-foreground font-medium tabular-nums">
                    {entry.value.toLocaleString()}
                  </span>
                </span>
              ))}
            </div>
          </Widget.Content>
        </Widget>
      </div>

      {/* Feed */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-foreground text-base font-semibold">
            Recent Actions
          </h2>
          <div className="flex items-center gap-2">
            <SearchField
              aria-label="Search actions"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  className="w-[200px]"
                  placeholder="Search actions..."
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <Dropdown>
              <Button size="sm" variant="secondary">
                <IconFilter1 />
                Type
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu
                  selectedKeys={typeFilter}
                  selectionMode="multiple"
                  onSelectionChange={(keys) => {
                    setTypeFilter(
                      keys === "all"
                        ? new Set(typeIds)
                        : new Set([...keys].map(String)),
                    );
                    setPage(1);
                  }}
                >
                  {typeIds.map((type) => {
                    const Icon = typeMeta[type].icon;

                    return (
                      <Dropdown.Item
                        key={type}
                        id={type}
                        textValue={typeMeta[type].label}
                      >
                        <Icon className="text-muted size-4" />
                        <Label>{typeMeta[type].label}</Label>
                        <Dropdown.ItemIndicator />
                      </Dropdown.Item>
                    );
                  })}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        </div>
        {isPending ? (
          <TableSkeleton rows={8} />
        ) : (
          <TableFetchingState isFetching={isFetching}>
            <DataGrid
              aria-label="Autopilot actions"
              columns={actionColumns}
              data={paginatedActions}
              getRowId={(action) => action.id}
              renderEmptyState={() => (
                <div className="text-muted py-8 text-center text-sm">
                  No actions match your filters.
                </div>
              )}
              sortDescriptor={sortDescriptor}
              variant="primary"
              onSortChange={setSortDescriptor}
            />
          </TableFetchingState>
        )}

        {/* Pagination footer */}
        <div className="flex items-center justify-between whitespace-nowrap text-xs">
          <Pagination size="sm">
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={safePage === 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Pagination.PreviousIcon />
                </Pagination.Previous>
              </Pagination.Item>
              {paginationPages.map((p) =>
                p.value === "ellipsis" ? (
                  <Pagination.Item key={p.key}>
                    <Pagination.Ellipsis />
                  </Pagination.Item>
                ) : (
                  <Pagination.Item key={p.key}>
                    <Pagination.Link
                      isActive={p.value === safePage}
                      onPress={() => setPage(p.value as number)}
                    >
                      {p.value}
                    </Pagination.Link>
                  </Pagination.Item>
                ),
              )}
              <Pagination.Item>
                <Pagination.Next
                  isDisabled={safePage === totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>

          <div className="flex items-center gap-3">
            <InlineSelect
              aria-label="Rows per page"
              value={String(rowsPerPage)}
              onChange={(v) => {
                if (v) {
                  setRowsPerPage(Number(v));
                  setPage(1);
                }
              }}
            >
              <InlineSelect.Trigger>
                <span className="text-muted">Rows per page</span>
                <InlineSelect.Value />
                <InlineSelect.Indicator />
              </InlineSelect.Trigger>
              <InlineSelect.Popover className="w-20">
                <ListBox>
                  {ROWS_PER_PAGE_OPTIONS.map((option) => (
                    <ListBox.Item
                      key={option}
                      id={String(option)}
                      textValue={String(option)}
                    >
                      {option}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </InlineSelect.Popover>
            </InlineSelect>
            <Separator className="!h-4" orientation="vertical" />
            <span className="text-muted tabular-nums">
              {visibleActions.length === 0
                ? "0 actions"
                : `${rangeStart}–${rangeEnd} of ${visibleActions.length}`}
            </span>
            <div className="flex gap-2">
              <Button
                isDisabled={safePage === 1}
                size="sm"
                variant="secondary"
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                isDisabled={safePage === totalPages}
                size="sm"
                variant="secondary"
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
