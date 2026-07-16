import {
  ArrowRight,
  ChevronRight,
  CircleFill,
  Eye,
  FileArrowUp,
  Funnel,
  Plane,
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
  Popover,
  SearchField,
  Separator,
  Slider,
  Spinner,
} from "@heroui/react";
import type { DataGridColumn } from "@heroui-pro/react";
import { DataGrid, InlineSelect, TextShimmer, Widget } from "@heroui-pro/react";
import { keepPreviousData } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { addHours, formatDistanceToNowStrict } from "date-fns";
import { useEffect, useState } from "react";
import type { SortDescriptor } from "react-aria-components";

import { ShipmentIntakeModal } from "#/components/shipment-intake-modal";
import { TableFetchingState, TableSkeleton } from "#/components/table-loading";
import { clientLogos } from "#/data/client-logos";
import type { ListShipmentsResponseDtoDataItem as ApiShipment } from "#/generated/api";
import {
  useClientsControllerFindAll,
  useShipmentsControllerFindAll,
  useShipmentsControllerStats,
} from "#/generated/api";
import { countryName } from "#/lib/countries";
import { formatCurrency, getInitials } from "#/lib/format";
import { useDebouncedUrlSearch } from "#/lib/use-debounced-url-search";
import { ROWS_PER_PAGE_OPTIONS, useRowsPerPage } from "#/lib/use-rows-per-page";
import type { PipelineSearch } from "#/routes/dashboard/pipeline";
import { pipelineListParams } from "#/routes/dashboard/pipeline";

/** Slider ceiling in dollars — fixed so the range control is stable. */
const MAX_SHIPMENT_VALUE = 500_000;

type PipelineStage = ApiShipment["stage"];

export const pipelineStages = [
  { id: "intake", label: "Intake" },
  { id: "classification", label: "Classification" },
  { id: "compliance", label: "Compliance" },
  { id: "entry", label: "Entry Prep" },
  { id: "filed", label: "Filed" },
] as const;

function ShipIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 10.189V14" />
      <path d="M12 2v3" />
      <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
      <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76" />
      <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Derivation — a shipment's live state comes straight from the API
 * -----------------------------------------------------------------------------------------------*/
export type ShipmentDisplayStatus =
  | "autopilot"
  | "awaiting"
  | "blocked"
  | "released";
type ShipmentStatus = ShipmentDisplayStatus;

export const statusFromApi: Record<ApiShipment["status"], ShipmentStatus> = {
  autopilot: "autopilot",
  awaiting_cbp: "awaiting",
  needs_review: "blocked",
  released: "released",
};

type Priority = 1 | 2 | 3 | 4;

interface Row {
  id: string;
  reference: string;
  client: string;
  logo?: string;
  origin: string;
  port: string;
  isAir: boolean;
  conveyance: string | null;
  stage: PipelineStage;
  status: ShipmentStatus;
  arrivesInHours: number;
  value: number;
  duty: number;
  /** Null when nothing is actionable (filed / awaiting CBP / released). */
  priority: Priority | null;
  /** Human-readable current pipeline step; null when nothing is running. */
  processingState: string | null;
}

const stageOrder: PipelineStage[] = [
  "intake",
  "classification",
  "compliance",
  "entry",
  "filed",
  "released",
];

/**
 * Priority derives from how much work remains vs. how soon the cargo lands,
 * nudged by shipment value. P1 is reserved for the extreme case: arrival is
 * imminent and the entry still isn't filed.
 */
function priorityFor(
  stage: PipelineStage,
  status: ShipmentStatus,
  arrivesInHours: number,
  value: number,
): Priority | null {
  // Filed, awaiting CBP, or released — it's not on us anymore.
  if (status === "released" || stage === "filed" || stage === "released")
    return null;

  const stagesLeft = 4 - stageOrder.indexOf(stage); // pre-filed stages remaining
  const hoursPerStage = arrivesInHours / Math.max(stagesLeft, 1);

  // Extreme: arrival is imminent, or the remaining stages leave almost no
  // time each (e.g. still in intake with the vessel hours away).
  if (arrivesInHours <= 8 || hoursPerStage < 4) return 1;

  let priority: Priority;

  if (hoursPerStage < 12) priority = 2;
  else if (hoursPerStage < 36) priority = 3;
  else priority = 4;

  // High-value shipments move up one level (but never into P1 on value alone).
  if (value >= 100000 && priority > 2) priority = (priority - 1) as Priority;

  return priority;
}

const priorityMeta: Record<
  Priority,
  { chip: "accent" | "danger" | "default" | "warning"; label: string }
> = {
  1: { chip: "danger", label: "P1" },
  2: { chip: "warning", label: "P2" },
  3: { chip: "accent", label: "P3" },
  4: { chip: "default", label: "P4" },
};

export const statusMeta: Record<
  ShipmentStatus,
  { chip: "accent" | "default" | "success" | "warning"; label: string }
> = {
  autopilot: { chip: "accent", label: "On Autopilot" },
  awaiting: { chip: "default", label: "Awaiting CBP" },
  blocked: { chip: "warning", label: "Needs Review" },
  released: { chip: "success", label: "Released" },
};

// Filter options carry the API status values (they live in the URL and are
// sent to the server); display maps through statusFromApi/statusMeta.
const statusOptions: Array<{ id: ApiShipment["status"]; label: string }> = [
  { id: "autopilot", label: "On Autopilot" },
  { id: "needs_review", label: "Needs Review" },
  { id: "awaiting_cbp", label: "Awaiting CBP" },
  { id: "released", label: "Released" },
];

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
    style: "currency",
  }).format(value);
}

function without<T>(set: Set<T>, value: T) {
  const next = new Set(set);

  next.delete(value);

  return next;
}

/* -------------------------------------------------------------------------------------------------
 * Stage tracker — the CI-run segments (shared with the shipment detail page)
 * -----------------------------------------------------------------------------------------------*/
export function StageTracker({
  stage,
  status,
}: {
  stage: PipelineStage;
  status: ShipmentStatus;
}) {
  const isReleased = stage === "released";
  const currentIndex = isReleased
    ? pipelineStages.length
    : pipelineStages.findIndex((s) => s.id === stage);
  const label = isReleased
    ? "Cleared"
    : (pipelineStages[currentIndex]?.label ?? "");

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center gap-1">
        {pipelineStages.map((s, index) => {
          let segment = "bg-default";

          if (isReleased) segment = "bg-success";
          else if (index < currentIndex) segment = "bg-accent";
          else if (index === currentIndex)
            segment =
              status === "blocked" ? "bg-danger" : "bg-accent animate-pulse";

          return (
            <span key={s.id} className={`h-1.5 w-6 rounded-full ${segment}`} />
          );
        })}
      </div>
      <span className="text-muted text-xs">
        {isReleased ? "Cleared · 5/5" : `${label} · ${currentIndex + 1}/5`}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * PipelineBoard
 * -----------------------------------------------------------------------------------------------*/
const routeApi = getRouteApi("/dashboard/pipeline");

export function PipelineBoard() {
  const navigate = useNavigate();
  const searchParams = routeApi.useSearch();
  const routeNavigate = routeApi.useNavigate();
  const [clientQuery, setClientQuery] = useState("");
  // Slider position while dragging; committed to the URL on release.
  const [pendingRange, setPendingRange] = useState<[number, number] | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useRowsPerPage();

  const [isIntakeOpen, setIntakeOpen] = useState(false);

  const updateSearch = (patch: Partial<PipelineSearch>) => {
    routeNavigate({
      replace: true,
      search: (prev) => ({ ...prev, ...patch }),
    });
  };

  const commitSearch = (q: string | undefined) => updateSearch({ q });
  const [searchInput, setSearchInput] = useDebouncedUrlSearch(
    searchParams.q,
    commitSearch,
  );

  // Any change to the URL-driven query state starts back at page 1.
  const filterFingerprint = JSON.stringify(searchParams);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fingerprint stands in for every search param
  useEffect(() => {
    setPage(1);
  }, [filterFingerprint]);

  const clientFilter = new Set<string>(searchParams.client ?? []);
  const statusFilter = new Set<string>(searchParams.status ?? []);
  const effectiveRange: [number, number] = pendingRange ?? [
    searchParams.valueMin ?? 0,
    searchParams.valueMax ?? MAX_SHIPMENT_VALUE,
  ];
  const valueActive =
    searchParams.valueMin !== undefined || searchParams.valueMax !== undefined;

  // DataGrid column ids ↔ server sort keys. The "client" column shows the
  // reference under the client name, so it sorts by reference.
  const sortByForColumn: Record<
    string,
    NonNullable<PipelineSearch["sortBy"]>
  > = {
    arrives: "etaAt",
    client: "reference",
    priority: "priority",
    stage: "stage",
    status: "status",
    value: "valueCents",
  };
  const columnForSortBy: Record<string, string> = {
    createdAt: "priority",
    etaAt: "arrives",
    priority: "priority",
    reference: "client",
    stage: "stage",
    status: "status",
    valueCents: "value",
  };

  const sortDescriptor: SortDescriptor = {
    column: columnForSortBy[searchParams.sortBy ?? "priority"] ?? "priority",
    direction:
      (searchParams.sortDir ?? "asc") === "asc" ? "ascending" : "descending",
  };

  const handleSortChange = (descriptor: SortDescriptor) => {
    updateSearch({
      sortBy: sortByForColumn[String(descriptor.column)] ?? "priority",
      sortDir: descriptor.direction === "ascending" ? "asc" : "desc",
    });
  };

  // Server-side list — filters, search, sorting, and pagination all in the
  // query; the page renders exactly what the API returns.
  const listParams = {
    ...pipelineListParams(searchParams, rowsPerPage),
    offset: (page - 1) * rowsPerPage,
  };
  const {
    data: shipmentsResponse,
    isFetching,
    isPending,
  } = useShipmentsControllerFindAll(listParams, {
    // Poll so new uploads and processing-state changes surface without a
    // manual refresh; keepPreviousData keeps the refetches invisible.
    query: { placeholderData: keepPreviousData, refetchInterval: 10_000 },
  });
  const { data: statsResponse } = useShipmentsControllerStats({
    query: { refetchInterval: 10_000 },
  });

  // The client filter needs the full client list; rows don't (the API embeds
  // the client on each shipment). Fetch it only once the filter is used.
  const [isClientMenuOpen, setClientMenuOpen] = useState(false);
  const { data: clientsResponse } = useClientsControllerFindAll(
    { limit: 100, sortBy: "name", sortDir: "asc" },
    { query: { enabled: isClientMenuOpen || clientFilter.size > 0 } },
  );

  const shipments = shipmentsResponse?.data.data ?? [];

  const rows: Row[] = shipments.map((shipment) => {
    const clientName = shipment.client?.name ?? "Unknown client";
    const status = statusFromApi[shipment.status];
    const arrivesInHours = shipment.etaAt
      ? (new Date(shipment.etaAt).getTime() - Date.now()) / 3_600_000
      : 0;
    const value = shipment.valueCents / 100;

    return {
      id: shipment.id,
      reference: shipment.reference,
      client: clientName,
      logo: shipment.client?.image ?? clientLogos[clientName],
      origin: shipment.originPort ?? countryName(shipment.originCountry),
      port: shipment.portOfEntry,
      isAir: shipment.transportMode === "air",
      conveyance: shipment.conveyance,
      stage: shipment.stage,
      status,
      arrivesInHours,
      value,
      duty: shipment.dutyCents / 100,
      priority: priorityFor(shipment.stage, status, arrivesInHours, value),
      processingState: shipment.processingState,
    };
  });

  const totalCount = shipmentsResponse?.data.count ?? 0;

  const allClients = (clientsResponse?.data.data ?? []).map((client) => ({
    id: client.id,
    name: client.name,
    logo: client.image ?? clientLogos[client.name],
  }));

  const byStatus = statsResponse?.data.byStatus;
  const stats = byStatus
    ? {
        active:
          byStatus.autopilot + byStatus.needs_review + byStatus.awaiting_cbp,
        autopilot: byStatus.autopilot + byStatus.awaiting_cbp,
        blocked: byStatus.needs_review,
        released: byStatus.released,
      }
    : { active: 0, autopilot: 0, blocked: 0, released: 0 };

  const statusActive = statusFilter.size > 0;

  const totalPages = Math.ceil(totalCount / rowsPerPage) || 1;
  const safePage = Math.min(page, totalPages);
  const paginatedRows = rows;

  const pages: Array<{ key: string; value: number | "ellipsis" }> = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++)
      pages.push({ key: `p-${i}`, value: i });
  } else {
    pages.push({ key: "p-1", value: 1 });
    if (safePage > 3) pages.push({ key: "e-start", value: "ellipsis" });
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);

    for (let i = start; i <= end; i++) pages.push({ key: `p-${i}`, value: i });
    if (safePage < totalPages - 2)
      pages.push({ key: "e-end", value: "ellipsis" });
    pages.push({ key: `p-${totalPages}`, value: totalPages });
  }

  const paginationPages = pages;

  const rangeStart = (safePage - 1) * rowsPerPage + 1;
  const rangeEnd = Math.min(safePage * rowsPerPage, totalCount);

  const hasActiveFilters =
    Boolean(searchParams.q) ||
    clientFilter.size > 0 ||
    statusActive ||
    valueActive;

  const clearFilters = () => {
    setSearchInput("");
    setClientQuery("");
    setPendingRange(null);
    updateSearch({
      client: undefined,
      q: undefined,
      status: undefined,
      valueMax: undefined,
      valueMin: undefined,
    });
  };

  const filteredClients = clientQuery
    ? allClients.filter((client) =>
        client.name.toLowerCase().includes(clientQuery.toLowerCase()),
      )
    : allClients;

  const columns: DataGridColumn<Row>[] = [
    {
      accessorKey: "client",
      allowsSorting: true,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="sm">
            <Avatar.Image src={row.logo} />
            <Avatar.Fallback>{getInitials(row.client)}</Avatar.Fallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate whitespace-nowrap text-sm font-medium">
              {row.client}
            </span>
            <span className="text-muted text-xs tabular-nums">
              {row.reference}
            </span>
          </div>
        </div>
      ),
      header: "Shipment",
      id: "client",
      isRowHeader: true,
      minWidth: 260,
      pinned: "start",
    },
    {
      cell: (row) => {
        const ModeIcon = row.isAir ? Plane : ShipIcon;
        const description = row.conveyance;
        return (
          <div className="flex items-start gap-2">
            <ModeIcon className="text-muted mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col">
              <span className="flex items-center gap-1 whitespace-nowrap text-sm">
                {row.origin}
                <ArrowRight className="text-muted size-3" />
                {row.port}
              </span>
              {description && (
                <span className="text-muted truncate text-xs">
                  {description}
                </span>
              )}
            </div>
          </div>
        );
      },
      header: "Route",
      id: "route",
      minWidth: 220,
    },
    {
      allowsSorting: true,
      cell: (row) => <StageTracker stage={row.stage} status={row.status} />,
      header: "Stage",
      id: "stage",
      minWidth: 190,
    },
    {
      allowsSorting: true,
      cell: (row) =>
        row.processingState ? (
          <Chip color="accent" size="sm" variant="soft">
            <Chip.Label className="inline-flex items-center gap-1.5 h-5.25">
              <Spinner size="sm" className="size-3" />
              <TextShimmer className="text-xs">
                {row.processingState}
              </TextShimmer>
            </Chip.Label>
          </Chip>
        ) : (
          <Chip color={statusMeta[row.status].chip} size="sm" variant="soft">
            <CircleFill width={6} />
            <Chip.Label>{statusMeta[row.status].label}</Chip.Label>
          </Chip>
        ),
      header: "Status",
      id: "status",
      minWidth: 130,
    },
    {
      accessorKey: "priority",
      allowsSorting: true,
      cell: (row) =>
        row.priority === null ? (
          <span className="text-muted text-sm">—</span>
        ) : (
          <Chip
            color={priorityMeta[row.priority].chip}
            size="sm"
            variant="soft"
          >
            <Chip.Label className="font-semibold tabular-nums">
              {priorityMeta[row.priority].label}
            </Chip.Label>
          </Chip>
        ),
      header: "Priority",
      headerClassName: "whitespace-nowrap",
      id: "priority",
      minWidth: 110,
    },
    {
      allowsSorting: true,
      cell: (row) => {
        const urgent =
          row.arrivesInHours >= 0 &&
          row.arrivesInHours <= 12 &&
          row.status !== "released";

        return (
          <span
            className={`whitespace-nowrap text-sm ${
              urgent
                ? "text-danger font-medium"
                : row.arrivesInHours < 0
                  ? "text-muted"
                  : ""
            }`}
          >
            {formatDistanceToNowStrict(
              addHours(new Date(), row.arrivesInHours),
              { addSuffix: true },
            )}
          </span>
        );
      },
      header: "Arrives",
      id: "arrives",
      minWidth: 120,
    },
    {
      align: "end",
      allowsSorting: true,
      cell: (row) => (
        <div className="flex flex-col items-end">
          <span className="font-medium tabular-nums">
            {formatCurrency(row.value)}
          </span>
          <span className="text-muted whitespace-nowrap text-xs tabular-nums">
            duty {formatCurrency(row.duty)}
          </span>
        </div>
      ),
      header: "Value",
      id: "value",
      minWidth: 150,
    },
    {
      align: "end",
      cell: (row) =>
        row.status === "blocked" ? (
          <Button
            size="sm"
            variant="tertiary"
            onPress={() =>
              navigate({
                params: { itemId: row.id },
                to: "/dashboard/review/$itemId",
              })
            }
          >
            <Eye />
            Review
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onPress={() =>
              navigate({
                params: { shipmentId: row.id },
                to: "/dashboard/shipments/$shipmentId",
              })
            }
          >
            Open
            <ChevronRight />
          </Button>
        ),
      header: "",
      id: "actions",
      minWidth: 120,
      pinned: "end",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground text-xl font-semibold">Pipeline</h1>
          <p className="text-muted mt-1 max-w-3xl text-sm">
            Every shipment as a live status stream. Green flows through
            untouched — anything blocked pops to the Review Queue.
          </p>
        </div>
        <Button size="sm" variant="primary" onPress={() => setIntakeOpen(true)}>
          <FileArrowUp />
          Create shipment
        </Button>
        <ShipmentIntakeModal
          isOpen={isIntakeOpen}
          onOpenChange={setIntakeOpen}
        />
      </div>

      {/* Overview */}
      <Widget>
        <Widget.Header>
          <Widget.Title>Overview</Widget.Title>
        </Widget.Header>
        <Widget.Content className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { title: "Active Shipments", value: stats.active },
            { title: "On Autopilot", value: stats.autopilot },
            { title: "Blocked in Review", value: stats.blocked },
            { title: "Released", value: stats.released },
          ].map((stat) => (
            <div key={stat.title} className="flex flex-col gap-1">
              <span className="text-muted text-sm font-medium">
                {stat.title}
              </span>
              <span className="text-foreground text-2xl font-semibold tabular-nums tracking-tight">
                {stat.value}
              </span>
            </div>
          ))}
        </Widget.Content>
      </Widget>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          aria-label="Search shipments"
          value={searchInput}
          onChange={setSearchInput}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              className="w-[220px]"
              placeholder="Search shipments..."
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        {/* Filter: Client */}
        <Dropdown onOpenChange={setClientMenuOpen}>
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
              className="max-h-96 overflow-y-auto"
              selectedKeys={clientFilter}
              selectionMode="multiple"
              onSelectionChange={(keys) => {
                const ids =
                  keys === "all"
                    ? allClients.map((client) => client.id)
                    : [...keys].map(String);

                updateSearch({ client: ids.length ? ids : undefined });
              }}
            >
              {filteredClients.length === 0 ? (
                <Dropdown.Item id="__no-match" isDisabled textValue="No match">
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
                      <Avatar.Image src={client.logo} />
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

        {/* Filter: Status */}
        <Dropdown>
          <Button size="sm" variant="secondary">
            <Funnel />
            Status
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              selectedKeys={statusFilter}
              selectionMode="multiple"
              onSelectionChange={(keys) => {
                const values =
                  keys === "all"
                    ? statusOptions.map((option) => option.id)
                    : ([...keys].map(String) as Array<ApiShipment["status"]>);

                updateSearch({ status: values.length ? values : undefined });
              }}
            >
              {statusOptions.map((option) => (
                <Dropdown.Item
                  key={option.id}
                  id={option.id}
                  textValue={option.label}
                >
                  <Chip
                    color={statusMeta[statusFromApi[option.id]].chip}
                    size="sm"
                    variant="soft"
                  >
                    <CircleFill width={6} />
                    <Chip.Label>{option.label}</Chip.Label>
                  </Chip>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        {/* Filter: Value range */}
        <Popover>
          <Button size="sm" variant="secondary">
            <Funnel />
            Value
          </Button>
          <Popover.Content className="w-80">
            <Popover.Dialog className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted text-xs font-medium">
                  Shipment value
                </span>
                <span className="text-foreground text-xs font-medium tabular-nums">
                  {compactCurrency(effectiveRange[0])} –{" "}
                  {compactCurrency(effectiveRange[1])}
                </span>
              </div>
              <Slider
                aria-label="Shipment value range"
                maxValue={MAX_SHIPMENT_VALUE}
                minValue={0}
                step={5000}
                value={effectiveRange}
                onChange={(value) => {
                  if (Array.isArray(value) && value.length === 2) {
                    setPendingRange(value as [number, number]);
                  }
                }}
                onChangeEnd={(value) => {
                  if (Array.isArray(value) && value.length === 2) {
                    setPendingRange(null);
                    updateSearch({
                      valueMin: value[0] > 0 ? value[0] : undefined,
                      valueMax:
                        value[1] < MAX_SHIPMENT_VALUE ? value[1] : undefined,
                    });
                  }
                }}
              >
                <Slider.Track>
                  <Slider.Fill />
                  <Slider.Thumb index={0} />
                  <Slider.Thumb index={1} />
                </Slider.Track>
              </Slider>
              <Button
                className="self-end"
                isDisabled={!valueActive}
                size="sm"
                variant="outline"
                onPress={() => {
                  setPendingRange(null);
                  updateSearch({ valueMax: undefined, valueMin: undefined });
                }}
              >
                Reset
              </Button>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
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
                {allClients.find((client) => client.id === clientId)?.name ??
                  clientId}
              </Chip.Label>
              <button
                aria-label="Remove client filter"
                className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
                type="button"
                onClick={() => {
                  const next = [...without(clientFilter, clientId)];

                  updateSearch({ client: next.length ? next : undefined });
                }}
              >
                <Xmark className="size-3" />
              </button>
            </Chip>
          ))}
          {statusActive
            ? [...statusFilter].map((status) => (
                <Chip key={status} size="sm" variant="secondary">
                  <Chip.Label>
                    {statusOptions.find((option) => option.id === status)
                      ?.label ?? status}
                  </Chip.Label>
                  <button
                    aria-label={`Remove ${status} filter`}
                    className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
                    type="button"
                    onClick={() => {
                      const next = [...without(statusFilter, status)] as Array<
                        ApiShipment["status"]
                      >;

                      updateSearch({ status: next.length ? next : undefined });
                    }}
                  >
                    <Xmark className="size-3" />
                  </button>
                </Chip>
              ))
            : null}
          {valueActive ? (
            <Chip size="sm" variant="secondary">
              <Chip.Label>
                Value: {compactCurrency(effectiveRange[0])} –{" "}
                {compactCurrency(effectiveRange[1])}
              </Chip.Label>
              <button
                aria-label="Remove value filter"
                className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
                type="button"
                onClick={() =>
                  updateSearch({ valueMax: undefined, valueMin: undefined })
                }
              >
                <Xmark className="size-3" />
              </button>
            </Chip>
          ) : null}
          <Button size="sm" variant="ghost" onPress={clearFilters}>
            Clear all
          </Button>
        </div>
      ) : null}

      {/* Run list */}
      {isPending ? (
        <TableSkeleton rows={8} />
      ) : (
        <TableFetchingState isFetching={isFetching}>
          <DataGrid
            aria-label="Shipment pipeline"
            columns={columns}
            contentClassName="min-w-[1200px]"
            data={paginatedRows}
            getRowId={(row) => row.id}
            renderEmptyState={() => (
              <div className="text-muted py-8 text-center text-sm">
                No shipments match your filters.
              </div>
            )}
            sortDescriptor={sortDescriptor}
            variant="primary"
            onSortChange={handleSortChange}
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
            {totalCount === 0
              ? "0 shipments"
              : `${rangeStart}–${rangeEnd} of ${totalCount}`}
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
  );
}
