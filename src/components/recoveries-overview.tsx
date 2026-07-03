import { CircleFill } from "@gravity-ui/icons";
import { Chip } from "@heroui/react";
import type { DataGridColumn } from "@heroui-pro/react";
import {
  BarChart,
  ChartTooltip,
  DataGrid,
  PieChart,
  TrendChip,
  Widget,
} from "@heroui-pro/react";

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
  identifiedAt: string;
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

const monthlyRecoveries = [
  { drawback: 18400, exclusion: 4100, month: "Jan", overpayment: 9200 },
  { drawback: 24800, exclusion: 6800, month: "Feb", overpayment: 7600 },
  { drawback: 31500, exclusion: 5400, month: "Mar", overpayment: 12300 },
  { drawback: 28200, exclusion: 9100, month: "Apr", overpayment: 15800 },
  { drawback: 42600, exclusion: 7300, month: "May", overpayment: 11400 },
  { drawback: 38900, exclusion: 12600, month: "Jun", overpayment: 18700 },
];

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
    identifiedAt: "2026-05-18",
    mechanism: "Drawback",
    status: "Filed",
  },
  {
    amount: 61800,
    client: "Atlas Machinery Corp.",
    confidence: 0.88,
    id: 2,
    identifiedAt: "2026-06-02",
    mechanism: "Drawback",
    status: "Identified",
  },
  {
    amount: 47300,
    client: "Cascade Apparel Group",
    confidence: 0.97,
    id: 3,
    identifiedAt: "2026-02-11",
    mechanism: "Overpayment",
    status: "Refunded",
  },
  {
    amount: 38900,
    client: "Bluewave Electronics",
    confidence: 0.91,
    id: 4,
    identifiedAt: "2026-04-27",
    mechanism: "Exclusion",
    status: "Filed",
  },
  {
    amount: 31200,
    client: "Lotus Textiles",
    confidence: 0.84,
    id: 5,
    identifiedAt: "2026-06-15",
    mechanism: "Drawback",
    status: "Identified",
  },
  {
    amount: 27400,
    client: "Harbor Foods Co.",
    confidence: 0.93,
    id: 6,
    identifiedAt: "2026-05-05",
    mechanism: "Overpayment",
    status: "Filed",
  },
  {
    amount: 22100,
    client: "Summit Footwear",
    confidence: 0.98,
    id: 7,
    identifiedAt: "2026-01-22",
    mechanism: "Drawback",
    status: "Refunded",
  },
  {
    amount: 18600,
    client: "Meridian Auto Parts",
    confidence: 0.79,
    id: 8,
    identifiedAt: "2026-06-21",
    mechanism: "Exclusion",
    status: "Identified",
  },
  {
    amount: 14800,
    client: "Vela Cosmetics",
    confidence: 0.86,
    id: 9,
    identifiedAt: "2026-06-09",
    mechanism: "Overpayment",
    status: "Identified",
  },
  {
    amount: 9700,
    client: "Titan Tools USA",
    confidence: 0.95,
    id: 10,
    identifiedAt: "2026-03-03",
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* -------------------------------------------------------------------------------------------------
 * Opportunities grid
 * -----------------------------------------------------------------------------------------------*/
const opportunityColumns: DataGridColumn<RecoveryOpportunity>[] = [
  {
    accessorKey: "client",
    cellClassName: "font-medium",
    header: "Client",
    id: "client",
    isRowHeader: true,
    minWidth: 200,
  },
  {
    accessorKey: "mechanism",
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
    cell: (item) => (
      <span className="font-medium tabular-nums">
        {formatCurrency(item.amount)}
      </span>
    ),
    header: "Amount",
    id: "amount",
    minWidth: 110,
  },
];

/* -------------------------------------------------------------------------------------------------
 * RecoveriesOverview
 * -----------------------------------------------------------------------------------------------*/
export function RecoveriesOverview() {
  return (
    <div className="flex w-full flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-foreground text-xl font-semibold">Recoveries</h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
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
        <h2 className="text-foreground text-base font-semibold">
          Open Opportunities
        </h2>
        <DataGrid
          aria-label="Recovery opportunities"
          columns={opportunityColumns}
          data={opportunities}
          getRowId={(item) => item.id}
          variant="primary"
        />
      </div>
    </div>
  );
}
