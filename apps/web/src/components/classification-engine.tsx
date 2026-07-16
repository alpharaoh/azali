import {
  Book,
  CircleInfo,
  Copy,
  CopyCheck,
  Funnel,
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
  EmptyState,
  InlineSelect,
  Widget,
} from "@heroui-pro/react";
import { keepPreviousData } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { format, formatDistanceToNowStrict, subMonths } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";

import { TableFetchingState, TableSkeleton } from "#/components/table-loading";
import type {
  ListProductsResponseDtoDataItem as ApiProduct,
  ProductsControllerListSortBy as ProductSortColumn,
  ProductsControllerListSourceItem as ProductSource,
  ProductsControllerListParams,
} from "#/generated/api";
import {
  useClientsControllerFindAll,
  useProductsControllerList,
  useProductsControllerStats,
} from "#/generated/api";
import { getInitials } from "#/lib/format";
import { HTS_CHAPTER_TITLES } from "#/lib/hts-chapters";
import { ROWS_PER_PAGE_OPTIONS, useRowsPerPage } from "#/lib/use-rows-per-page";
import type { ClassificationsSearch } from "#/routes/dashboard/classifications";

/* -------------------------------------------------------------------------------------------------
 * Meta
 * -----------------------------------------------------------------------------------------------*/
const sourceMeta: Record<
  ProductSource,
  { chip: "default" | "success"; label: string }
> = {
  agent: { chip: "default", label: "Auto-classified" },
  broker: { chip: "success", label: "Broker-approved" },
};

const sourceIds = Object.keys(sourceMeta) as ProductSource[];

const SEARCH_DEBOUNCE_MS = 300;

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
 * Overview — real aggregates over the knowledge base
 * -----------------------------------------------------------------------------------------------*/
function OverviewStats() {
  const { data: response } = useProductsControllerStats({
    query: { placeholderData: keepPreviousData },
  });
  const stats = response?.data;

  const tiles: Array<{ info?: string; title: string; value: string }> = [
    {
      title: "Knowledge Base Entries",
      value: stats?.entries.toLocaleString("en-US") ?? "—",
    },
    {
      info: "Shipment lines classified straight from the knowledge base, with no re-classification needed. This is why touches per entry falls.",
      title: "Total Reuses",
      value: stats?.totalReuses.toLocaleString("en-US") ?? "—",
    },
    {
      info: "Entries a licensed broker set or confirmed — these are trusted and reused automatically.",
      title: "Broker-Approved",
      value: stats?.brokerApproved.toLocaleString("en-US") ?? "—",
    },
    {
      title: "Chapters Covered",
      value: stats?.chaptersCovered.toLocaleString("en-US") ?? "—",
    },
  ];

  return (
    <Widget>
      <Widget.Header>
        <Widget.Title>Overview</Widget.Title>
      </Widget.Header>
      <Widget.Content className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((stat) => (
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
            <span className="text-foreground text-2xl font-semibold tabular-nums tracking-tight">
              {stat.value}
            </span>
          </div>
        ))}
      </Widget.Content>
    </Widget>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Charts — knowledge base growth + the chapters it concentrates in
 * -----------------------------------------------------------------------------------------------*/
function EngineCharts() {
  // Same query key as the overview tiles — React Query dedupes the request.
  const { data: response } = useProductsControllerStats({
    query: { placeholderData: keepPreviousData },
  });
  const stats = response?.data;

  // Trailing six months, cumulative — each point counts every product
  // classified up to and including that month.
  const growthSeries = useMemo(() => {
    const growth = stats?.growth ?? [];

    return [...Array(6)].map((_, index) => {
      const date = subMonths(new Date(), 5 - index);
      const key = format(date, "yyyy-MM");
      const entries = growth
        .filter((point) => point.month <= key)
        .reduce((sum, point) => sum + point.added, 0);

      return { entries, month: format(date, "MMM") };
    });
  }, [stats?.growth]);

  const topChapters = stats?.topChapters ?? [];
  const maxChapterCount = Math.max(
    1,
    ...topChapters.map((chapter) => chapter.count),
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Widget className="lg:col-span-2">
        <Widget.Header>
          <Widget.Title>Catalog Growth</Widget.Title>
          <span className="text-muted text-xs">
            Cumulative classified products
          </span>
        </Widget.Header>
        <Widget.Content>
          <AreaChart data={growthSeries} height={220}>
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
            <AreaChart.YAxis allowDecimals={false} width={40} />
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
          {topChapters.length === 0 ? (
            <span className="text-muted text-sm">
              Chapters appear as products are classified.
            </span>
          ) : (
            topChapters.map((chapter) => (
              <div key={chapter.chapter} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground min-w-0 truncate">
                    <span className="text-muted font-mono text-xs">
                      Ch. {chapter.chapter}
                    </span>{" "}
                    {HTS_CHAPTER_TITLES[chapter.chapter] ?? ""}
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
            ))
          )}
        </Widget.Content>
      </Widget>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ClassificationEngine — the read-only knowledge base
 * -----------------------------------------------------------------------------------------------*/
const routeApi = getRouteApi("/dashboard/classifications");

export function ClassificationEngine() {
  // Filters, search, and sorting live in the URL; pagination is ephemeral
  // component state.
  const searchParams = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const [searchInput, setSearchInput] = useState(searchParams.q ?? "");
  const [clientQuery, setClientQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useRowsPerPage();

  const clientFilter = useMemo(
    () => new Set<string>(searchParams.clientId ?? []),
    [searchParams.clientId],
  );
  const sourceFilter = useMemo(
    () => new Set<string>(searchParams.source ?? []),
    [searchParams.source],
  );
  const sortDescriptor: SortDescriptor = {
    column: searchParams.sortBy ?? "reuseCount",
    direction: searchParams.sortDir === "asc" ? "ascending" : "descending",
  };

  const updateSearch = useCallback(
    (patch: Partial<ClassificationsSearch>) => {
      navigate({
        search: (prev) => ({ ...prev, ...patch }),
        replace: true,
      });
    },
    [navigate],
  );

  // Keep the input in sync with the URL (back/forward, shared links).
  useEffect(() => {
    setSearchInput(searchParams.q ?? "");
  }, [searchParams.q]);

  // Debounce typing into the URL.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((searchParams.q ?? "") !== searchInput) {
        updateSearch({ q: searchInput || undefined });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput, searchParams.q, updateSearch]);

  // Any change to the URL-driven query state starts back at page 1 (covers
  // both in-app updates and browser back/forward).
  const filterFingerprint = JSON.stringify(searchParams);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fingerprint stands in for every search param
  useEffect(() => {
    setPage(1);
  }, [filterFingerprint]);

  const params: ProductsControllerListParams = {
    search: searchParams.q,
    clientId: searchParams.clientId,
    source: searchParams.source,
    sortBy: searchParams.sortBy ?? "reuseCount",
    sortDir: searchParams.sortDir ?? "desc",
    limit: rowsPerPage,
    offset: (page - 1) * rowsPerPage,
  };

  const {
    data: response,
    isFetching,
    isPending,
  } = useProductsControllerList(params, {
    query: { placeholderData: keepPreviousData },
  });

  const products = response?.data.data ?? [];
  const count = response?.data.count ?? 0;

  // The client filter's options — the org's clients, alphabetical.
  const { data: clientsResponse } = useClientsControllerFindAll({
    limit: 100,
    sortBy: "name",
    sortDir: "asc",
  });
  const allClients = clientsResponse?.data.data ?? [];
  const filteredClients = clientQuery
    ? allClients.filter((client) =>
        client.name.toLowerCase().includes(clientQuery.toLowerCase()),
      )
    : allClients;
  const clientNameById = useMemo(
    () => new Map(allClients.map((client) => [client.id, client.name])),
    [allClients],
  );

  const hasActiveFilters =
    !!searchParams.q || clientFilter.size > 0 || sourceFilter.size > 0;

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setClientQuery("");
    updateSearch({ q: undefined, clientId: undefined, source: undefined });
  }, [updateSearch]);

  const totalPages = Math.ceil(count / rowsPerPage) || 1;
  const safePage = Math.min(page, totalPages);

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

  const rangeStart = count === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(safePage * rowsPerPage, count);

  const columns = useMemo<DataGridColumn<ApiProduct>[]>(
    () => [
      {
        accessorKey: "name",
        allowsSorting: true,
        cell: (product) => (
          <div className="flex min-w-0 max-w-96 flex-col">
            <span className="text-foreground truncate text-sm font-medium">
              {product.name}
            </span>
            {product.sku ? (
              <span className="text-muted truncate text-xs tabular-nums">
                {product.sku}
              </span>
            ) : null}
          </div>
        ),
        header: "Product",
        id: "name",
        isRowHeader: true,
        maxWidth: 240,
        minWidth: 200,
        width: 240,
      },
      {
        accessorKey: "clientId",
        cell: (product) => (
          <span className="block min-w-0 truncate text-sm">
            {product.client?.name ?? "—"}
          </span>
        ),
        header: "Client",
        id: "client",
        maxWidth: 200,
        minWidth: 160,
        width: 200,
      },
      {
        accessorKey: "htsCode",
        allowsSorting: true,
        cell: (product) =>
          product.htsCode ? <CopyHts>{product.htsCode}</CopyHts> : "—",
        header: "HTS Code",
        id: "htsCode",
        minWidth: 160,
      },
      {
        accessorKey: "dutyRate",
        cell: (product) => {
          const duty =
            product.dutyRate?.effective ?? product.dutyRate?.general ?? null;

          return (
            <span
              className="text-muted block min-w-0 truncate whitespace-nowrap text-sm tabular-nums"
              title={duty ?? undefined}
            >
              {duty ?? "—"}
            </span>
          );
        },
        header: "Duty",
        id: "duty",
        maxWidth: 260,
        minWidth: 160,
        width: 220,
      },
      {
        accessorKey: "source",
        cell: (product) => {
          const meta = sourceMeta[product.source as ProductSource];

          return meta ? (
            <Chip color={meta.chip} size="sm" variant="soft">
              <Chip.Label>{meta.label}</Chip.Label>
            </Chip>
          ) : (
            <span className="text-muted text-sm">—</span>
          );
        },
        header: "Source",
        id: "source",
        minWidth: 150,
      },
      {
        accessorKey: "confidence",
        allowsSorting: true,
        cell: (product) => (
          <span className="text-muted text-sm tabular-nums">
            {product.confidence !== null
              ? `${Math.round(product.confidence * 100)}%`
              : "—"}
          </span>
        ),
        header: "Confidence",
        id: "confidence",
        minWidth: 100,
      },
      {
        accessorKey: "reuseCount",
        align: "end",
        allowsSorting: true,
        cell: (product) => (
          <span className="font-medium tabular-nums">
            {product.reuseCount.toLocaleString("en-US")}
          </span>
        ),
        header: "Hits",
        id: "reuseCount",
        minWidth: 80,
      },
      {
        accessorKey: "lastReusedAt",
        allowsSorting: true,
        cell: (product) => (
          <span className="text-muted whitespace-nowrap text-sm">
            {product.lastReusedAt
              ? formatDistanceToNowStrict(new Date(product.lastReusedAt), {
                  addSuffix: true,
                })
              : "Never"}
          </span>
        ),
        header: "Last Used",
        id: "lastReusedAt",
        minWidth: 110,
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
        <p className="text-muted mt-1 max-w-3xl text-sm">
          Every code your team has ever approved, reusable forever. Corrections
          in the Review Queue land here automatically.
        </p>
      </div>

      {/* Overview */}
      <OverviewStats />

      {/* Charts */}
      <EngineCharts />

      {/* Knowledge base */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-foreground text-base font-semibold">
              Knowledge Base
            </h2>
            <Chip size="sm" variant="soft">
              {count}
            </Chip>
          </div>
          <div className="flex items-center gap-2">
            <SearchField
              aria-label="Search the knowledge base"
              value={searchInput}
              onChange={setSearchInput}
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
                    const next =
                      keys === "all"
                        ? allClients.map((client) => client.id)
                        : [...keys].map(String);

                    updateSearch({ clientId: next.length ? next : undefined });
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
                    filteredClients.map((client) => (
                      <Dropdown.Item
                        key={client.id}
                        id={client.id}
                        textValue={client.name}
                      >
                        <Avatar className="size-6 shrink-0">
                          <Avatar.Fallback className="text-[10px]">
                            {getInitials(client.name)}
                          </Avatar.Fallback>
                        </Avatar>
                        <Label>{client.name}</Label>
                        <Dropdown.ItemIndicator />
                      </Dropdown.Item>
                    ))
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
                    const next =
                      keys === "all"
                        ? sourceIds
                        : ([...keys].map(String) as ProductSource[]);

                    updateSearch({ source: next.length ? next : undefined });
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
            {searchParams.q ? (
              <Chip size="sm" variant="secondary">
                <Chip.Label>Search: {searchParams.q}</Chip.Label>
                <button
                  aria-label="Clear search"
                  className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    updateSearch({ q: undefined });
                  }}
                >
                  <Xmark className="size-3" />
                </button>
              </Chip>
            ) : null}
            {[...clientFilter].map((clientId) => (
              <Chip key={clientId} size="sm" variant="secondary">
                <Chip.Label>
                  {clientNameById.get(clientId) ?? "Client"}
                </Chip.Label>
                <button
                  aria-label="Remove client filter"
                  className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
                  type="button"
                  onClick={() => {
                    const next = [...clientFilter].filter(
                      (id) => id !== clientId,
                    );

                    updateSearch({ clientId: next.length ? next : undefined });
                  }}
                >
                  <Xmark className="size-3" />
                </button>
              </Chip>
            ))}
            {[...sourceFilter].map((source) => (
              <Chip key={source} size="sm" variant="secondary">
                <Chip.Label>
                  {sourceMeta[source as ProductSource]?.label ?? source}
                </Chip.Label>
                <button
                  aria-label={`Remove ${source} filter`}
                  className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
                  type="button"
                  onClick={() => {
                    const next = [...sourceFilter].filter(
                      (s) => s !== source,
                    ) as ProductSource[];

                    updateSearch({ source: next.length ? next : undefined });
                  }}
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

        {/* Table */}
        {isPending ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="relative">
            <TableFetchingState isFetching={isFetching}>
              <DataGrid
                aria-label="Classification knowledge base"
                columns={columns}
                contentClassName="min-w-[1360px]"
                data={products}
                getRowId={(product) => product.id}
                renderEmptyState={() => <div className="h-[280px]" />}
                sortDescriptor={sortDescriptor}
                variant="primary"
                onSortChange={(descriptor) => {
                  updateSearch({
                    sortBy: descriptor.column as ProductSortColumn,
                    sortDir:
                      descriptor.direction === "ascending" ? "asc" : "desc",
                  });
                }}
              />
            </TableFetchingState>
            {/* Centered over the grid instead of inside its horizontally
                scrollable content, so it stays put when scrolling */}
            {products.length === 0 && !isFetching && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <EmptyState className="pointer-events-auto" size="sm">
                  <EmptyState.Header>
                    <EmptyState.Media className="border" variant="icon">
                      <Book />
                    </EmptyState.Media>
                    <EmptyState.Title>No Entries Found</EmptyState.Title>
                    <EmptyState.Description>
                      {hasActiveFilters
                        ? "No classified products match your search or filters."
                        : "Classified products land here automatically as shipments flow through the pipeline."}
                    </EmptyState.Description>
                  </EmptyState.Header>
                  {hasActiveFilters ? (
                    <EmptyState.Content className="flex-row gap-2">
                      <Button variant="ghost" onPress={clearFilters}>
                        Clear Filters
                      </Button>
                    </EmptyState.Content>
                  ) : null}
                </EmptyState>
              </div>
            )}
          </div>
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
              {count === 0
                ? "0 entries"
                : `${rangeStart}–${rangeEnd} of ${count}`}
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
