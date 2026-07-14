import {
  ChevronRight,
  CircleCheck,
  CircleFill,
  Funnel,
  MagicWand,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Chip,
  Dropdown,
  Label,
  ListBox,
  Pagination,
  SearchField,
  Separator,
} from "@heroui/react";
import type { DataGridColumn } from "@heroui-pro/react";
import {
  BarChart,
  ChartTooltip,
  DataGrid,
  InlineSelect,
  PieChart,
  TrendChip,
  Widget,
} from "@heroui-pro/react";
import { format, subDays, subMonths } from "date-fns";
import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";

import { ROWS_PER_PAGE_OPTIONS, useRowsPerPage } from "#/lib/use-rows-per-page";

/* -------------------------------------------------------------------------------------------------
 * Types & Data
 * -----------------------------------------------------------------------------------------------*/
type Mechanism = "Drawback" | "Overpayment" | "Exclusion";
type ClaimStatus = "Identified" | "Filed" | "Refunded";

interface RecoveryOpportunity {
  id: number;
  client: string;
  mechanism: Mechanism;
  amount: number;
  confidence: number;
  status: ClaimStatus;
  identifiedAt: Date;
}

const kpiCards = [
  {
    change: "+18%",
    title: "Total Identified",
    trend: "up" as const,
    value: "$482K",
  },
  {
    change: "+24%",
    title: "Recovered YTD",
    trend: "up" as const,
    value: "$305K",
  },
  {
    change: "+3",
    title: "Claims in Flight",
    trend: "up" as const,
    value: "12",
  },
  {
    change: "+2.1%",
    title: "Success Rate",
    trend: "up" as const,
    value: "94%",
  },
];

const monthlyTotals = [
  { drawback: 18400, exclusion: 4100, overpayment: 9200 },
  { drawback: 24800, exclusion: 6800, overpayment: 7600 },
  { drawback: 31500, exclusion: 5400, overpayment: 12300 },
  { drawback: 28200, exclusion: 9100, overpayment: 15800 },
  { drawback: 42600, exclusion: 7300, overpayment: 11400 },
  { drawback: 38900, exclusion: 12600, overpayment: 18700 },
];

// Trailing six months ending with the current month, so the chart never goes stale.
const monthlyRecoveries = monthlyTotals.map((totals, index) => ({
  ...totals,
  month: format(subMonths(new Date(), monthlyTotals.length - 1 - index), "MMM"),
}));

const mechanismColors: Record<Mechanism, string> = {
  Drawback: "var(--chart-1)",
  Exclusion: "var(--chart-3)",
  Overpayment: "var(--chart-2)",
};

const identifiedByMechanism = [
  { color: mechanismColors.Drawback, name: "Drawback", value: 268400 },
  { color: mechanismColors.Overpayment, name: "Overpayment", value: 130800 },
  { color: mechanismColors.Exclusion, name: "Exclusion", value: 83100 },
];

const opportunities: RecoveryOpportunity[] = [
  {
    amount: 84200,
    client: "Pacific Rim Imports",
    confidence: 0.96,
    id: 1,
    identifiedAt: subDays(new Date(), 45),
    mechanism: "Drawback",
    status: "Filed",
  },
  {
    amount: 61800,
    client: "Atlas Machinery Corp.",
    confidence: 0.88,
    id: 2,
    identifiedAt: subDays(new Date(), 30),
    mechanism: "Drawback",
    status: "Identified",
  },
  {
    amount: 47300,
    client: "Cascade Apparel Group",
    confidence: 0.97,
    id: 3,
    identifiedAt: subDays(new Date(), 141),
    mechanism: "Overpayment",
    status: "Refunded",
  },
  {
    amount: 38900,
    client: "Bluewave Electronics",
    confidence: 0.91,
    id: 4,
    identifiedAt: subDays(new Date(), 66),
    mechanism: "Exclusion",
    status: "Filed",
  },
  {
    amount: 31200,
    client: "Lotus Textiles",
    confidence: 0.84,
    id: 5,
    identifiedAt: subDays(new Date(), 17),
    mechanism: "Drawback",
    status: "Identified",
  },
  {
    amount: 27400,
    client: "Harbor Foods Co.",
    confidence: 0.93,
    id: 6,
    identifiedAt: subDays(new Date(), 58),
    mechanism: "Overpayment",
    status: "Filed",
  },
  {
    amount: 22100,
    client: "Summit Footwear",
    confidence: 0.98,
    id: 7,
    identifiedAt: subDays(new Date(), 161),
    mechanism: "Drawback",
    status: "Refunded",
  },
  {
    amount: 18600,
    client: "Meridian Auto Parts",
    confidence: 0.79,
    id: 8,
    identifiedAt: subDays(new Date(), 11),
    mechanism: "Exclusion",
    status: "Identified",
  },
  {
    amount: 14800,
    client: "Vela Cosmetics",
    confidence: 0.86,
    id: 9,
    identifiedAt: subDays(new Date(), 23),
    mechanism: "Overpayment",
    status: "Identified",
  },
  {
    amount: 9700,
    client: "Titan Tools USA",
    confidence: 0.95,
    id: 10,
    identifiedAt: subDays(new Date(), 121),
    mechanism: "Exclusion",
    status: "Refunded",
  },
];

const statusColorMap: Record<ClaimStatus, "success" | "warning" | "accent"> = {
  Filed: "accent",
  Identified: "warning",
  Refunded: "success",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDate(date: Date) {
  return format(date, "MMM d, yyyy");
}

/* -------------------------------------------------------------------------------------------------
 * Row action — status-dependent next step
 * -----------------------------------------------------------------------------------------------*/
function OpportunityAction({ status }: { status: ClaimStatus }) {
  if (status === "Refunded") {
    return (
      <Chip color="success" size="sm" variant="soft">
        <CircleCheck />
        <Chip.Label>Complete</Chip.Label>
      </Chip>
    );
  }

  return (
    <Button size="sm" variant="outline">
      Open
      <ChevronRight />
    </Button>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Opportunities grid
 * -----------------------------------------------------------------------------------------------*/
const opportunityColumns: DataGridColumn<RecoveryOpportunity>[] = [
  {
    accessorKey: "client",
    allowsSorting: true,
    cellClassName: "font-medium",
    header: "Client",
    id: "client",
    isRowHeader: true,
    minWidth: 200,
  },
  {
    accessorKey: "mechanism",
    allowsSorting: true,
    cell: (item) => (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <CircleFill
          style={{ color: mechanismColors[item.mechanism] }}
          width={6}
        />
        {item.mechanism}
      </span>
    ),
    header: "Mechanism",
    id: "mechanism",
    minWidth: 140,
  },
  {
    accessorKey: "confidence",
    allowsSorting: true,
    cell: (item) => (
      <span className="text-muted tabular-nums">
        {Math.round(item.confidence * 100)}%
      </span>
    ),
    header: "Confidence",
    id: "confidence",
    minWidth: 100,
  },
  {
    accessorKey: "status",
    allowsSorting: true,
    cell: (item) => (
      <Chip color={statusColorMap[item.status]} size="sm" variant="soft">
        <CircleFill width={6} />
        <Chip.Label>{item.status}</Chip.Label>
      </Chip>
    ),
    header: "Status",
    id: "status",
    minWidth: 110,
  },
  {
    accessorKey: "identifiedAt",
    allowsSorting: true,
    cell: (item) => (
      <span className="text-muted whitespace-nowrap text-sm">
        {formatDate(item.identifiedAt)}
      </span>
    ),
    header: "Identified",
    id: "identifiedAt",
    minWidth: 120,
  },
  {
    accessorKey: "amount",
    align: "end",
    allowsSorting: true,
    cell: (item) => (
      <span className="font-medium tabular-nums">
        {formatCurrency(item.amount)}
      </span>
    ),
    header: "Amount",
    id: "amount",
    minWidth: 110,
  },
  {
    align: "end",
    cell: (item) => <OpportunityAction status={item.status} />,
    header: "",
    id: "actions",
    minWidth: 160,
    pinned: "end",
  },
];

/* -------------------------------------------------------------------------------------------------
 * RecoveriesOverview
 * -----------------------------------------------------------------------------------------------*/
export function RecoveriesOverview() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "amount",
    direction: "descending",
  });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useRowsPerPage();

  const visibleOpportunities = useMemo(() => {
    let result = opportunities;

    if (search) {
      const q = search.toLowerCase();

      result = result.filter((o) => o.client.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status.toLowerCase() === statusFilter);
    }
    if (!sortDescriptor.column) return result;

    return [...result].sort((a, b) => {
      const col = sortDescriptor.column as string;
      let cmp: number;

      if (col === "amount") {
        cmp = a.amount - b.amount;
      } else if (col === "confidence") {
        cmp = a.confidence - b.confidence;
      } else if (col === "identifiedAt") {
        cmp = a.identifiedAt.getTime() - b.identifiedAt.getTime();
      } else {
        cmp = String(
          (a as unknown as Record<string, unknown>)[col] ?? "",
        ).localeCompare(
          String((b as unknown as Record<string, unknown>)[col] ?? ""),
        );
      }

      if (sortDescriptor.direction === "descending") cmp *= -1;

      return cmp;
    });
  }, [search, statusFilter, sortDescriptor]);

  const totalPages = Math.ceil(visibleOpportunities.length / rowsPerPage) || 1;
  const safePage = Math.min(page, totalPages);
  const paginatedOpportunities = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;

    return visibleOpportunities.slice(start, start + rowsPerPage);
  }, [visibleOpportunities, safePage, rowsPerPage]);

  const paginationPages = useMemo(() => {
    const pages: Array<{ key: string; value: number | "ellipsis" }> = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++)
        pages.push({ key: `p-${i}`, value: i });
    } else {
      pages.push({ key: "p-1", value: 1 });
      if (safePage > 3) pages.push({ key: "e-start", value: "ellipsis" });
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);

      for (let i = start; i <= end; i++)
        pages.push({ key: `p-${i}`, value: i });
      if (safePage < totalPages - 2)
        pages.push({ key: "e-end", value: "ellipsis" });
      pages.push({ key: `p-${totalPages}`, value: totalPages });
    }

    return pages;
  }, [totalPages, safePage]);

  const rangeStart = (safePage - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(
    safePage * rowsPerPage,
    visibleOpportunities.length,
  );

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Demo preview banner */}
      <Alert status="accent">
        <Alert.Indicator>
          <MagicWand />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>
            Demo preview
            <Chip className="ml-2" color="accent" size="sm" variant="soft">
              <Chip.Label>Coming soon</Chip.Label>
            </Chip>
          </Alert.Title>
          <Alert.Description>
            The data on this page is illustrative — Recoveries is not yet
            enabled for your account. Talk to your business representative to
            unlock automated drawback, overpayment, and exclusion recovery for
            your clients.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      {/* Header */}
      <div>
        <h1 className="text-foreground text-xl font-semibold">Recoveries</h1>
        <p className="text-muted mt-1 max-w-3xl text-sm">
          Drawback and refund opportunities the AI surfaces from entry history,
          and claims in flight.
        </p>
      </div>

      {/* Overview KPIs */}
      <Widget>
        <Widget.Header>
          <Widget.Title>Overview</Widget.Title>
        </Widget.Header>
        <Widget.Content className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <div key={card.title} className="flex flex-col gap-1">
              <span className="text-muted text-sm font-medium">
                {card.title}
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

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Widget className="lg:col-span-2">
          <Widget.Header>
            <Widget.Title>Recovered by Month</Widget.Title>
            <Widget.Legend>
              <Widget.LegendItem color={mechanismColors.Drawback}>
                Drawback
              </Widget.LegendItem>
              <Widget.LegendItem color={mechanismColors.Overpayment}>
                Overpayment
              </Widget.LegendItem>
              <Widget.LegendItem color={mechanismColors.Exclusion}>
                Exclusion
              </Widget.LegendItem>
            </Widget.Legend>
          </Widget.Header>
          <Widget.Content>
            <BarChart data={monthlyRecoveries} height={240}>
              <BarChart.Grid vertical={false} />
              <BarChart.XAxis dataKey="month" tickMargin={8} />
              <BarChart.YAxis
                tickFormatter={(v: number) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                }
                width={48}
              />
              <BarChart.Bar
                dataKey="drawback"
                fill={mechanismColors.Drawback}
                name="Drawback"
                stackId="recovered"
              />
              <BarChart.Bar
                dataKey="overpayment"
                fill={mechanismColors.Overpayment}
                name="Overpayment"
                stackId="recovered"
              />
              <BarChart.Bar
                dataKey="exclusion"
                fill={mechanismColors.Exclusion}
                name="Exclusion"
                radius={[4, 4, 0, 0]}
                stackId="recovered"
              />
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
                            {formatCurrency(Number(entry.value))}
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
            <Widget.Title>Identified by Mechanism</Widget.Title>
          </Widget.Header>
          <Widget.Content>
            <PieChart height={200}>
              <PieChart.Pie
                data={identifiedByMechanism}
                dataKey="value"
                innerRadius={55}
                nameKey="name"
                outerRadius={80}
                strokeWidth={0}
              >
                {identifiedByMechanism.map((entry) => (
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
                            {formatCurrency(Number(entry.value))}
                          </ChartTooltip.Value>
                        </ChartTooltip.Item>
                      ))}
                    </ChartTooltip>
                  );
                }}
              />
            </PieChart>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {identifiedByMechanism.map((entry) => (
                <span
                  key={entry.name}
                  className="text-muted inline-flex items-center gap-1.5 text-xs"
                >
                  <CircleFill style={{ color: entry.color }} width={6} />
                  {entry.name}
                  <span className="text-foreground font-medium tabular-nums">
                    {formatCurrency(entry.value)}
                  </span>
                </span>
              ))}
            </div>
          </Widget.Content>
        </Widget>
      </div>

      {/* Opportunities queue */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-foreground text-base font-semibold">
            Open Opportunities
          </h2>
          <div className="flex items-center gap-2">
            <SearchField
              aria-label="Search opportunities"
              value={search}
              onChange={setSearch}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  className="w-[180px]"
                  placeholder="Search clients..."
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <Dropdown>
              <Button size="sm" variant="secondary">
                <Funnel />
                Status
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu
                  selectedKeys={new Set([statusFilter])}
                  selectionMode="single"
                  onSelectionChange={(keys) => {
                    const key = [...keys][0] as string | undefined;

                    setStatusFilter(key ?? "all");
                  }}
                >
                  <Dropdown.Item id="all" textValue="All">
                    <Label>All</Label>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                  <Dropdown.Item id="identified" textValue="Identified">
                    <Label>Identified</Label>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                  <Dropdown.Item id="filed" textValue="Filed">
                    <Label>Filed</Label>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                  <Dropdown.Item id="refunded" textValue="Refunded">
                    <Label>Refunded</Label>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        </div>
        <DataGrid
          aria-label="Recovery opportunities"
          columns={opportunityColumns}
          data={paginatedOpportunities}
          getRowId={(item) => item.id}
          renderEmptyState={() => (
            <div className="text-muted py-8 text-center text-sm">
              No opportunities match your filters.
            </div>
          )}
          sortDescriptor={sortDescriptor}
          variant="primary"
          onSortChange={setSortDescriptor}
        />

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
              <InlineSelect.Popover className="w-[80px]">
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
              {visibleOpportunities.length === 0
                ? "0 opportunities"
                : `${rangeStart}–${rangeEnd} of ${visibleOpportunities.length}`}
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
