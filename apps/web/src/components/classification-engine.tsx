import {
  ArrowUp,
  ChevronRight,
  CircleInfo,
  Copy,
  CopyCheck,
  Funnel,
  MagicWand,
  Paperclip,
  Xmark,
} from "@gravity-ui/icons";
import {
  Avatar,
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
  AreaChart,
  ChartTooltip,
  DataGrid,
  InlineSelect,
  PromptInput,
  TrendChip,
  Widget,
} from "@heroui-pro/react";
import {
  format,
  formatDistanceToNowStrict,
  subDays,
  subMonths,
} from "date-fns";
import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";

import type {
  CatalogEntry,
  CatalogSource,
  SandboxRule,
} from "#/data/classification-engine";
import {
  catalogEntries,
  catalogGrowthTotals,
  sandboxFallback,
  sandboxRules,
  topChapters,
} from "#/data/classification-engine";
import { ROWS_PER_PAGE_OPTIONS, useRowsPerPage } from "#/lib/use-rows-per-page";

/* -------------------------------------------------------------------------------------------------
 * Meta
 * -----------------------------------------------------------------------------------------------*/
type CatalogRow = CatalogEntry & { learnedNow?: boolean };

const sourceMeta: Record<
  CatalogSource,
  { chip: "accent" | "default" | "success"; label: string }
> = {
  approved: { chip: "success", label: "Broker-approved" },
  auto: { chip: "default", label: "Auto-classified" },
  corrected: { chip: "accent", label: "Corrected" },
};

const sourceIds = Object.keys(sourceMeta) as CatalogSource[];

const overviewStats: Array<{
  change: string;
  info?: string;
  title: string;
  trend: "neutral" | "up";
  value: string;
}> = [
  { change: "+41", title: "Catalog Entries", trend: "up", value: "1,284" },
  {
    change: "+1.2%",
    info: "Share of shipment lines resolved straight from the catalog, with no re-classification needed. This is why touches per entry falls.",
    title: "Auto-Reuse Rate",
    trend: "up",
    value: "91%",
  },
  {
    change: "+3",
    info: "Every correction teaches the engine — the corrected code becomes the catalog entry going forward.",
    title: "Corrections This Month",
    trend: "neutral",
    value: "14",
  },
  {
    change: "+2",
    title: "Chapters Covered",
    trend: "neutral",
    value: "38",
  },
];

// Trailing six months ending with the current month, so the chart never goes stale.
const catalogGrowth = catalogGrowthTotals.map((entries, index) => ({
  entries,
  month: format(
    subMonths(new Date(), catalogGrowthTotals.length - 1 - index),
    "MMM",
  ),
}));

const maxChapterCount = Math.max(...topChapters.map((c) => c.count));

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function toStringSet(
  keys: "all" | Iterable<unknown>,
  all: string[],
): Set<string> {
  return keys === "all" ? new Set(all) : new Set([...keys].map(String));
}

function without<T>(set: Set<T>, value: T) {
  const next = new Set(set);

  next.delete(value);

  return next;
}

/* -------------------------------------------------------------------------------------------------
 * CopyText — inline copyable HTS code
 * -----------------------------------------------------------------------------------------------*/
function CopyHts({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <Tooltip>
        <Button
          isIconOnly
          aria-label={copied ? "Copied" : "Copy"}
          className="text-muted hover:text-foreground size-5 min-h-5 min-w-5"
          size="sm"
          variant="ghost"
          onPress={handleCopy}
        >
          {copied ? (
            <CopyCheck className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
        </Button>
        <Tooltip.Content>{copied ? "Copied!" : "Copy"}</Tooltip.Content>
      </Tooltip>
      <span className="font-mono text-xs">{children}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Sandbox — try the engine on anything
 * -----------------------------------------------------------------------------------------------*/
function classify(query: string): SandboxRule {
  const q = query.toLowerCase();

  return (
    sandboxRules.find((rule) =>
      rule.keywords.some((keyword) => q.includes(keyword)),
    ) ?? sandboxFallback
  );
}

function EngineSandbox() {
  const [query, setQuery] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [result, setResult] = useState<{
    query: string;
    rule: SandboxRule;
  } | null>(null);

  const handleClassify = () => {
    const trimmed = query.trim();

    if (!trimmed || isClassifying) return;
    setIsClassifying(true);
    setResult(null);
    setQuery("");
    setTimeout(() => {
      setResult({ query: trimmed, rule: classify(trimmed) });
      setIsClassifying(false);
    }, 900);
  };

  return (
    <Widget>
      <Widget.Header>
        <Widget.Title className="inline-flex items-center gap-2">
          <MagicWand className="text-muted size-4" />
          Test the Engine
        </Widget.Title>
        <span className="text-muted text-xs">
          Describe any product — the engine proposes a code
        </span>
      </Widget.Header>
      <Widget.Content className="flex flex-col gap-3">
        <PromptInput
          value={query}
          onSubmit={handleClassify}
          onValueChange={setQuery}
        >
          <PromptInput.Shell>
            <PromptInput.Content>
              <PromptInput.TextArea placeholder='Try "wireless earbuds, silicone tips, bluetooth 5.3" or "women&apos;s wool blazer"…' />
            </PromptInput.Content>
            <PromptInput.Toolbar>
              <PromptInput.ToolbarStart>
                <PromptInput.Action
                  aria-label="Attach spec sheet"
                  tooltip="Attach spec sheet"
                >
                  <Paperclip className="size-4" />
                </PromptInput.Action>
              </PromptInput.ToolbarStart>
              <PromptInput.ToolbarEnd>
                <PromptInput.Send>
                  <ArrowUp className="size-4" />
                </PromptInput.Send>
              </PromptInput.ToolbarEnd>
            </PromptInput.Toolbar>
          </PromptInput.Shell>
          <PromptInput.Footer>
            The engine proposes — a licensed broker approves. Check important
            classifications.
          </PromptInput.Footer>
        </PromptInput>

        {isClassifying ? (
          <span className="text-muted animate-pulse text-sm">
            Analyzing product attributes and searching precedent…
          </span>
        ) : null}

        {result ? (
          <div className="bg-background/40 flex flex-col gap-2 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted text-xs font-medium">
                Proposed classification for “{result.query}”
              </span>
              <Chip
                color={result.rule.confidence >= 0.9 ? "success" : "warning"}
                size="sm"
                variant="soft"
              >
                <Chip.Label>
                  {Math.round(result.rule.confidence * 100)}% confident
                </Chip.Label>
              </Chip>
            </div>
            <span className="text-foreground font-mono text-xl font-semibold tracking-tight">
              {result.rule.hts}
            </span>
            <span className="text-muted text-sm">
              {result.rule.htsDescription} · {result.rule.dutyRate}
            </span>
            <ul className="text-muted mt-1 flex list-disc flex-col gap-1 pl-4 text-xs">
              {result.rule.reasoning.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button size="sm" variant="ghost">
                Send to Review Queue
              </Button>
            </div>
          </div>
        ) : null}
      </Widget.Content>
    </Widget>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ClassificationEngine
 * -----------------------------------------------------------------------------------------------*/
export function ClassificationEngine() {
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<Set<string>>(new Set());
  const [clientQuery, setClientQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useRowsPerPage();
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "uses",
    direction: "descending",
  });

  const allEntries = useMemo<CatalogRow[]>(() => catalogEntries, []);

  const allClients = useMemo(
    () => [...new Set(allEntries.map((entry) => entry.client))].sort(),
    [allEntries],
  );

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = allEntries.filter(
      (entry) =>
        (clientFilter.size === 0 || clientFilter.has(entry.client)) &&
        (sourceFilter.size === 0 || sourceFilter.has(entry.source)) &&
        (query.length === 0 ||
          entry.product.toLowerCase().includes(query) ||
          entry.sku.toLowerCase().includes(query) ||
          entry.hts.includes(query) ||
          entry.client.toLowerCase().includes(query)),
    );

    return [...result].sort((a, b) => {
      // Freshly learned entries always surface first.
      if ((a.learnedNow ?? false) !== (b.learnedNow ?? false))
        return a.learnedNow ? -1 : 1;

      const col = sortDescriptor.column as string;
      let cmp: number;

      if (col === "uses") {
        cmp = a.uses - b.uses;
      } else if (col === "confidence") {
        cmp = a.confidence - b.confidence;
      } else if (col === "lastUsed") {
        cmp = b.lastUsedDaysAgo - a.lastUsedDaysAgo;
      } else if (col === "client") {
        cmp = a.client.localeCompare(b.client);
      } else {
        cmp = a.product.localeCompare(b.product);
      }

      if (sortDescriptor.direction === "descending") cmp *= -1;

      return cmp;
    });
  }, [allEntries, search, clientFilter, sourceFilter, sortDescriptor]);

  const totalPages = Math.ceil(visibleEntries.length / rowsPerPage) || 1;
  const safePage = Math.min(page, totalPages);
  const paginatedEntries = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;

    return visibleEntries.slice(start, start + rowsPerPage);
  }, [visibleEntries, safePage, rowsPerPage]);

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
  const rangeEnd = Math.min(safePage * rowsPerPage, visibleEntries.length);

  const filteredClients = clientQuery
    ? allClients.filter((client) =>
        client.toLowerCase().includes(clientQuery.toLowerCase()),
      )
    : allClients;

  const hasActiveFilters =
    search.length > 0 || clientFilter.size > 0 || sourceFilter.size > 0;

  const clearFilters = () => {
    setSearch("");
    setClientFilter(new Set());
    setClientQuery("");
    setSourceFilter(new Set());
    setPage(1);
  };

  const columns = useMemo<DataGridColumn<CatalogRow>[]>(
    () => [
      {
        accessorKey: "product",
        allowsSorting: true,
        cell: (entry) => (
          <div className="flex min-w-0 flex-col">
            <span className="text-foreground truncate text-sm font-medium">
              {entry.product}
            </span>
            <span className="text-muted truncate text-xs tabular-nums">
              {entry.sku}
            </span>
          </div>
        ),
        header: "Product",
        id: "product",
        isRowHeader: true,
        maxWidth: 300,
        minWidth: 240,
        width: 300,
      },
      {
        accessorKey: "client",
        allowsSorting: true,
        cell: (entry) => (
          <span className="block min-w-0 truncate text-sm">{entry.client}</span>
        ),
        header: "Client",
        id: "client",
        maxWidth: 200,
        minWidth: 160,
        width: 200,
      },
      {
        accessorKey: "hts",
        cell: (entry) => <CopyHts>{entry.hts}</CopyHts>,
        header: "HTS Code",
        id: "hts",
        minWidth: 160,
      },
      {
        accessorKey: "dutyRate",
        cell: (entry) => (
          <span className="text-muted text-sm tabular-nums">
            {entry.dutyRate}
          </span>
        ),
        header: "Duty",
        id: "duty",
        minWidth: 80,
      },
      {
        accessorKey: "source",
        cell: (entry) =>
          entry.learnedNow ? (
            <Chip color="accent" size="sm" variant="soft">
              <Chip.Label>Learned today</Chip.Label>
            </Chip>
          ) : (
            <Chip
              color={sourceMeta[entry.source].chip}
              size="sm"
              variant="soft"
            >
              <Chip.Label>{sourceMeta[entry.source].label}</Chip.Label>
            </Chip>
          ),
        header: "Source",
        id: "source",
        minWidth: 150,
      },
      {
        accessorKey: "confidence",
        allowsSorting: true,
        cell: (entry) => (
          <span className="text-muted text-sm tabular-nums">
            {Math.round(entry.confidence * 100)}%
          </span>
        ),
        header: "Confidence",
        id: "confidence",
        minWidth: 100,
      },
      {
        accessorKey: "uses",
        align: "end",
        allowsSorting: true,
        cell: (entry) => (
          <span className="font-medium tabular-nums">
            {entry.uses.toLocaleString("en-US")}
          </span>
        ),
        header: "Uses",
        id: "uses",
        minWidth: 80,
      },
      {
        accessorKey: "lastUsedDaysAgo",
        allowsSorting: true,
        cell: (entry) => (
          <span className="text-muted whitespace-nowrap text-sm">
            {entry.learnedNow
              ? "just now"
              : formatDistanceToNowStrict(
                  subDays(new Date(), entry.lastUsedDaysAgo),
                  { addSuffix: true },
                )}
          </span>
        ),
        header: "Last Used",
        id: "lastUsed",
        minWidth: 110,
      },
      {
        align: "end",
        cell: () => (
          <Button size="sm" variant="ghost">
            Open
            <ChevronRight />
          </Button>
        ),
        header: "",
        id: "actions",
        minWidth: 90,
        pinned: "end",
      },
    ],
    [],
  );

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-foreground text-xl font-semibold">
          Classification Engine
        </h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Every code your team has ever approved, reusable forever. Corrections
          in the Review Queue land here automatically.
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
                      <CircleInfo className="size-3.5" />
                    </Button>
                    <Tooltip.Content className="max-w-64">
                      {stat.info}
                    </Tooltip.Content>
                  </Tooltip>
                ) : null}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-foreground text-2xl font-semibold tabular-nums tracking-tight">
                  {stat.value}
                </span>
                <TrendChip trend={stat.trend} variant="soft">
                  {stat.change}
                </TrendChip>
              </div>
            </div>
          ))}
        </Widget.Content>
      </Widget>

      {/* Sandbox */}
      <EngineSandbox />

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Widget className="lg:col-span-2">
          <Widget.Header>
            <Widget.Title>Catalog Growth</Widget.Title>
            <span className="text-muted text-xs">
              Cumulative approved classifications
            </span>
          </Widget.Header>
          <Widget.Content>
            <AreaChart data={catalogGrowth} height={220}>
              <defs>
                <linearGradient id="catalog-growth" x1="0" x2="0" y1="0" y2="1">
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
              <AreaChart.YAxis width={40} />
              <AreaChart.Area
                dataKey="entries"
                dot={false}
                fill="url(#catalog-growth)"
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
          </Widget.Content>
        </Widget>

        <Widget>
          <Widget.Header>
            <Widget.Title>Top Chapters</Widget.Title>
          </Widget.Header>
          <Widget.Content className="flex flex-col gap-3">
            {topChapters.map((chapter) => (
              <div key={chapter.chapter} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground min-w-0 truncate">
                    <span className="text-muted font-mono text-xs">
                      Ch. {chapter.chapter}
                    </span>{" "}
                    {chapter.label}
                  </span>
                  <span className="text-muted shrink-0 tabular-nums">
                    {chapter.count}
                  </span>
                </div>
                <div className="bg-default/60 h-1 w-full rounded-full">
                  <div
                    className="bg-accent h-1 rounded-full"
                    style={{
                      width: `${(chapter.count / maxChapterCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </Widget.Content>
        </Widget>
      </div>

      {/* Catalog */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-foreground text-base font-semibold">Catalog</h2>
          <div className="flex items-center gap-2">
            <SearchField
              aria-label="Search catalog"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  className="w-[220px]"
                  placeholder="Search products, codes..."
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>

            {/* Filter: Client */}
            <Dropdown>
              <Button size="sm" variant="secondary">
                <Funnel />
                Client
              </Button>
              <Dropdown.Popover className="w-72">
                <div className="p-1.5 pb-2">
                  <SearchField
                    aria-label="Search clients"
                    value={clientQuery}
                    onChange={setClientQuery}
                  >
                    <SearchField.Group className="rounded-full">
                      <SearchField.SearchIcon />
                      <SearchField.Input placeholder="Search clients..." />
                      <SearchField.ClearButton />
                    </SearchField.Group>
                  </SearchField>
                </div>
                <Dropdown.Menu
                  className="max-h-60 overflow-y-auto"
                  selectedKeys={clientFilter}
                  selectionMode="multiple"
                  onSelectionChange={(keys) => {
                    setClientFilter(toStringSet(keys, allClients));
                    setPage(1);
                  }}
                >
                  {filteredClients.length === 0 ? (
                    <Dropdown.Item
                      id="__no-match"
                      isDisabled
                      textValue="No match"
                    >
                      <Label>No clients match</Label>
                    </Dropdown.Item>
                  ) : (
                    filteredClients.map((client) => {
                      const count = allEntries.filter(
                        (entry) => entry.client === client,
                      ).length;

                      return (
                        <Dropdown.Item
                          key={client}
                          id={client}
                          textValue={client}
                        >
                          <Avatar className="size-6 shrink-0">
                            <Avatar.Fallback className="text-[10px]">
                              {getInitials(client)}
                            </Avatar.Fallback>
                          </Avatar>
                          <Label>
                            {client} ({count})
                          </Label>
                          <Dropdown.ItemIndicator />
                        </Dropdown.Item>
                      );
                    })
                  )}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>

            {/* Filter: Source */}
            <Dropdown>
              <Button size="sm" variant="secondary">
                <Funnel />
                Source
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu
                  selectedKeys={sourceFilter}
                  selectionMode="multiple"
                  onSelectionChange={(keys) => {
                    setSourceFilter(toStringSet(keys, sourceIds));
                    setPage(1);
                  }}
                >
                  {sourceIds.map((source) => (
                    <Dropdown.Item
                      key={source}
                      id={source}
                      textValue={sourceMeta[source].label}
                    >
                      <Chip
                        color={sourceMeta[source].chip}
                        size="sm"
                        variant="soft"
                      >
                        <Chip.Label>{sourceMeta[source].label}</Chip.Label>
                      </Chip>
                      <Dropdown.ItemIndicator />
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        </div>

        {/* Active filters */}
        {hasActiveFilters ? (
          <div className="flex flex-wrap items-center gap-2">
            {search ? (
              <Chip size="sm" variant="secondary">
                <Chip.Label>Search: {search}</Chip.Label>
                <button
                  aria-label="Clear search"
                  className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
                  type="button"
                  onClick={() => setSearch("")}
                >
                  <Xmark className="size-3" />
                </button>
              </Chip>
            ) : null}
            {[...clientFilter].map((client) => (
              <Chip key={client} size="sm" variant="secondary">
                <Chip.Label>{client}</Chip.Label>
                <button
                  aria-label={`Remove ${client} filter`}
                  className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
                  type="button"
                  onClick={() => setClientFilter(without(clientFilter, client))}
                >
                  <Xmark className="size-3" />
                </button>
              </Chip>
            ))}
            {[...sourceFilter].map((source) => (
              <Chip key={source} size="sm" variant="secondary">
                <Chip.Label>
                  {sourceMeta[source as CatalogSource]?.label ?? source}
                </Chip.Label>
                <button
                  aria-label={`Remove ${source} filter`}
                  className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
                  type="button"
                  onClick={() => setSourceFilter(without(sourceFilter, source))}
                >
                  <Xmark className="size-3" />
                </button>
              </Chip>
            ))}
            <Button size="sm" variant="ghost" onPress={clearFilters}>
              Clear all
            </Button>
          </div>
        ) : null}

        <DataGrid
          aria-label="Classification catalog"
          columns={columns}
          contentClassName="min-w-[1200px]"
          data={paginatedEntries}
          getRowId={(entry) => entry.id}
          renderEmptyState={() => (
            <div className="text-muted py-8 text-center text-sm">
              No catalog entries match your filters.
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
              {visibleEntries.length === 0
                ? "0 entries"
                : `${rangeStart}–${rangeEnd} of ${visibleEntries.length}`}
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
