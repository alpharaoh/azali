import {
  ArrowDownToLine,
  Calendar,
  CircleFill,
  CirclePause,
  CirclePlay,
  Copy,
  CopyCheck,
  EllipsisVertical,
  Eye,
  Funnel,
  LayoutColumns3,
  Pencil,
  Persons,
  Plus,
  Sliders,
  TrashBin,
  Xmark,
} from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Chip,
  Dropdown,
  Label,
  ListBox,
  Modal,
  Pagination,
  SearchField,
  Separator,
  Tooltip,
  toast,
} from "@heroui/react";
import type { DataGridColumn } from "@heroui-pro/react";
import {
  ActionBar,
  DataGrid,
  EmptyState,
  InlineSelect,
} from "@heroui-pro/react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Selection, SortDescriptor } from "react-aria-components";
import { useLocalStorage } from "usehooks-ts";
import { ClientFormDrawer } from "#/components/client-form-drawer";
import { TableFetchingState, TableSkeleton } from "#/components/table-loading";
import { clientLogos } from "#/data/client-logos";
import type {
  ListClientsResponseDtoDataItem as ApiClient,
  ClientsControllerFindAllAutonomyItem as ClientAutonomy,
  ClientsControllerFindAllSortBy as ClientSortColumn,
  ClientsControllerFindAllStatusItem as ClientStatus,
  ClientsControllerFindAllParams,
} from "#/generated/api";
import {
  getClientsControllerFindAllQueryKey,
  useClientsControllerFindAll,
  useClientsControllerRemove,
  useClientsControllerUpdate,
} from "#/generated/api";
import { getCountryFlag } from "#/lib/country-flag";
import { capitalize, formatDate } from "#/lib/format";
import { useDebouncedUrlSearch } from "#/lib/use-debounced-url-search";
import { ROWS_PER_PAGE_OPTIONS, useRowsPerPage } from "#/lib/use-rows-per-page";
import type { ClientsSearch } from "#/routes/dashboard/clients";

/* -------------------------------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------------------------*/
const statuses: ClientStatus[] = ["active", "paused"];
const autonomyModes: ClientAutonomy[] = ["autopilot", "supervised"];

const statusColorMap: Record<ClientStatus, "success" | "danger"> = {
  active: "success",
  paused: "danger",
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string) {
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

const MAX_VISIBLE_PORTS = 3;

const ALL_COLUMNS = [
  "name",
  "iorNumber",
  "bondNumber",
  "primaryOrigin",
  "industry",
  "autonomy",
  "status",
  "createdAt",
  "portsOfEntry",
  "actions",
] as const;

const SORT_OPTIONS: Array<{ id: ClientSortColumn; label: string }> = [
  { id: "name", label: "Client" },
  { id: "iorNumber", label: "IOR #" },
  { id: "primaryOrigin", label: "Primary Origin" },
  { id: "industry", label: "Industry" },
  { id: "autonomy", label: "Autonomy" },
  { id: "status", label: "Status" },
  { id: "createdAt", label: "Client Since" },
];

const COLUMN_LABELS: Array<{ id: string; label: string }> = [
  { id: "name", label: "Client" },
  { id: "iorNumber", label: "IOR #" },
  { id: "bondNumber", label: "Bond #" },
  { id: "primaryOrigin", label: "Primary Origin" },
  { id: "industry", label: "Industry" },
  { id: "autonomy", label: "Autonomy" },
  { id: "status", label: "Status" },
  { id: "createdAt", label: "Client Since" },
  { id: "portsOfEntry", label: "Ports of Entry" },
];

function csvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function exportClientsCsv(rows: ApiClient[]) {
  const header = [
    "Client",
    "IOR #",
    "Bond #",
    "Primary Origin",
    "Industry",
    "Autonomy",
    "Status",
    "Ports of Entry",
    "Client Since",
  ];
  const lines = rows.map((client) =>
    [
      client.name,
      client.iorNumber,
      client.bondNumber,
      countryName(client.primaryOrigin),
      client.industry,
      capitalize(client.autonomy),
      capitalize(client.status),
      client.portsOfEntry.join("; "),
      formatDate(client.createdAt),
    ]
      .map(csvValue)
      .join(","),
  );
  const csv = [header.map(csvValue).join(","), ...lines].join("\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);

  return rows.length;
}

/* -------------------------------------------------------------------------------------------------
 * CopyText — inline copyable text with tooltip feedback
 * -----------------------------------------------------------------------------------------------*/
function CopyText({ children }: { children: string }) {
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
      <span className="text-muted text-xs tabular-nums">{children}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * OriginCell — flag + country name
 * -----------------------------------------------------------------------------------------------*/
function OriginCell({ code }: { code: string }) {
  const Flag = getCountryFlag(code);

  return (
    <span className="inline-flex items-center gap-2">
      {Flag && <Flag className="h-3.5 w-5 shrink-0 rounded-sm" />}
      <span className="text-sm">{countryName(code)}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * PortsCell — inline chip list with overflow count
 * -----------------------------------------------------------------------------------------------*/
function PortsCell({ ports }: { ports: string[] }) {
  const visible = ports.slice(0, MAX_VISIBLE_PORTS);
  const overflow = ports.length - MAX_VISIBLE_PORTS;

  return (
    <span className="inline-flex items-center gap-1">
      {visible.map((port) => (
        <Chip key={port} size="sm" variant="secondary">
          <Chip.Label>{port}</Chip.Label>
        </Chip>
      ))}
      {overflow > 0 && (
        <Chip size="sm" variant="secondary">
          <Chip.Label>+{overflow}</Chip.Label>
        </Chip>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ClientsTable
 * -----------------------------------------------------------------------------------------------*/
const routeApi = getRouteApi("/dashboard/clients");

export function ClientsTable() {
  // Filters, search, and sorting live in the URL; column visibility in
  // localStorage; pagination and selection are ephemeral component state.
  const searchParams = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useRowsPerPage();
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());
  const [storedColumns, setStoredColumns] = useLocalStorage<string[]>(
    "azali:clients-columns",
    [...ALL_COLUMNS],
  );

  const statusFilter = new Set<string>(searchParams.status ?? []);
  const autonomyFilter = new Set<string>(searchParams.autonomy ?? []);
  const sortDescriptor: SortDescriptor = {
    column: searchParams.sortBy ?? "createdAt",
    direction: searchParams.sortDir === "asc" ? "ascending" : "descending",
  };

  const updateSearch = (patch: Partial<ClientsSearch>) => {
    navigate({
      search: (prev) => ({ ...prev, ...patch }),
      replace: true,
    });
  };

  const commitSearch = (q: string | undefined) => updateSearch({ q });
  const [searchInput, setSearchInput] = useDebouncedUrlSearch(
    searchParams.q,
    commitSearch,
  );

  // Any change to the URL-driven query state starts back at page 1 (covers
  // both in-app updates and browser back/forward).
  const filterFingerprint = JSON.stringify(searchParams);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fingerprint stands in for every search param
  useEffect(() => {
    setPage(1);
  }, [filterFingerprint]);

  const queryClient = useQueryClient();
  const removeClient = useClientsControllerRemove();

  const params: ClientsControllerFindAllParams = {
    search: searchParams.q,
    status: searchParams.status,
    autonomy: searchParams.autonomy,
    sortBy: searchParams.sortBy ?? "createdAt",
    sortDir: searchParams.sortDir ?? "desc",
    limit: rowsPerPage,
    offset: (page - 1) * rowsPerPage,
  };

  const {
    data: response,
    isFetching,
    isPending,
  } = useClientsControllerFindAll(params, {
    query: { placeholderData: keepPreviousData },
  });

  const clients = response?.data.data ?? [];
  const count = response?.data.count ?? 0;

  const statusActive = statusFilter.size > 0;
  const autonomyActive = autonomyFilter.size > 0;

  const clearFilters = () => {
    setSearchInput("");
    updateSearch({ q: undefined, status: undefined, autonomy: undefined });
  };

  const handleDelete = async (ids: string[]) => {
    await Promise.all(ids.map((id) => removeClient.mutateAsync({ id })));
    setSelectedKeys(new Set());
    await queryClient.invalidateQueries({
      queryKey: getClientsControllerFindAllQueryKey(),
    });
  };

  const updateClient = useClientsControllerUpdate();

  const selectedClients =
    selectedKeys === "all"
      ? clients
      : clients.filter((client) =>
          (selectedKeys as Set<string | number>).has(client.id),
        );

  const pausedSelection = selectedClients.filter(
    (client) => client.status === "paused",
  );
  const activeSelection = selectedClients.filter(
    (client) => client.status === "active",
  );

  const handleSetStatus = (targets: ApiClient[], status: ClientStatus) => {
    if (!targets.length) return;

    const verb = status === "paused" ? "Paus" : "Resum";
    const run = Promise.all(
      targets.map((client) =>
        updateClient.mutateAsync({ id: client.id, data: { status } }),
      ),
    ).then(async () => {
      setSelectedKeys(new Set());
      await queryClient.invalidateQueries({
        queryKey: getClientsControllerFindAllQueryKey(),
      });

      return targets.length;
    });

    toast.promise(run, {
      error: `Failed to ${verb.toLowerCase()}e clients`,
      loading: `${verb}ing clients...`,
      success: (changed) =>
        `${verb}ed ${changed} client${changed === 1 ? "" : "s"}`,
    });
  };

  const handleExport = () => {
    toast.promise(exportClientsCsv(selectedClients), {
      error: "Failed to export clients",
      loading: "Exporting clients...",
      success: (exported) =>
        `Exported ${exported} client${exported === 1 ? "" : "s"} to CSV`,
    });
  };

  const [pendingDelete, setPendingDelete] = useState<ApiClient[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formClient, setFormClient] = useState<ApiClient | null>(null);

  const openCreateForm = () => {
    setFormClient(null);
    setFormOpen(true);
  };

  const openEditForm = (client: ApiClient) => {
    setFormClient(client);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete?.length) return;
    setIsDeleting(true);
    try {
      await handleDelete(pendingDelete.map((client) => client.id));
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.ceil(count / rowsPerPage) || 1;
  const safePage = Math.min(page, totalPages);

  const visibleColumnSet = new Set<string>([...storedColumns, "actions"]);

  const allCols: DataGridColumn<ApiClient>[] = [
    {
      accessorKey: "name",
      allowsSorting: true,
      cell: (item) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <Avatar.Image src={item.image ?? clientLogos[item.name]} />
            <Avatar.Fallback>
              {item.name
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("")}
            </Avatar.Fallback>
          </Avatar>
          <span className="text-sm font-medium">{item.name}</span>
        </div>
      ),
      header: "Client",
      id: "name",
      isRowHeader: true,
      minWidth: 240,
      pinned: "start",
    },
    {
      accessorKey: "iorNumber",
      allowsSorting: true,
      cell: (item) => <CopyText>{item.iorNumber}</CopyText>,
      header: "IOR #",
      id: "iorNumber",
      minWidth: 130,
    },
    {
      accessorKey: "bondNumber",
      cell: (item) => <CopyText>{item.bondNumber}</CopyText>,
      header: "Bond #",
      id: "bondNumber",
      minWidth: 130,
    },
    {
      accessorKey: "primaryOrigin",
      allowsSorting: true,
      cell: (item) => <OriginCell code={item.primaryOrigin} />,
      header: "Primary Origin",
      id: "primaryOrigin",
      minWidth: 140,
    },
    {
      accessorKey: "industry",
      allowsSorting: true,
      header: "Industry",
      id: "industry",
      minWidth: 160,
    },
    {
      accessorKey: "autonomy",
      allowsSorting: true,
      cell: (item) => (
        <Chip
          color={item.autonomy === "autopilot" ? "accent" : "default"}
          size="sm"
          variant="soft"
        >
          <Chip.Label>{capitalize(item.autonomy)}</Chip.Label>
        </Chip>
      ),
      header: "Autonomy",
      id: "autonomy",
      minWidth: 110,
    },
    {
      accessorKey: "status",
      allowsSorting: true,
      cell: (item) => (
        <Chip color={statusColorMap[item.status]} size="sm" variant="soft">
          <CircleFill width={6} />
          <Chip.Label>{capitalize(item.status)}</Chip.Label>
        </Chip>
      ),
      header: "Status",
      id: "status",
      minWidth: 110,
    },
    {
      accessorKey: "createdAt",
      allowsSorting: true,
      cell: (item) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
          <Calendar className="text-muted size-3.5" />
          {formatDate(item.createdAt)}
        </span>
      ),
      header: "Client Since",
      id: "createdAt",
      minWidth: 140,
    },
    {
      accessorKey: "portsOfEntry",
      cell: (item) => <PortsCell ports={item.portsOfEntry} />,
      header: "Ports of Entry",
      id: "portsOfEntry",
      minWidth: 280,
    },
    {
      align: "end",
      cell: (item) => (
        <RowActions
          clientId={item.id}
          onDelete={() => setPendingDelete([item])}
          onEdit={() => openEditForm(item)}
        />
      ),
      header: "",
      id: "actions",
      minWidth: 50,
      pinned: "end",
      width: 50,
    },
  ];

  const columns: DataGridColumn<ApiClient>[] = allCols.filter((c) =>
    visibleColumnSet.has(c.id),
  );

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
  };

  const selectionCount =
    selectedKeys === "all"
      ? clients.length
      : (selectedKeys as Set<string | number>).size;

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

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-xl font-semibold">Clients</h1>
            <Chip size="sm" variant="soft">
              {count}
            </Chip>
          </div>
          <p className="text-muted text-sm">
            Importer profiles, bonds, POAs, and catalogs.
          </p>
        </div>
        <Button variant="primary" onPress={openCreateForm}>
          Add Client
          <Plus />
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <SearchField
          aria-label="Search clients"
          value={searchInput}
          onChange={handleSearchChange}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              className="w-[200px]"
              placeholder="Search clients..."
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {/* Filter: Autonomy */}
        <Dropdown>
          <Button size="sm" variant="secondary">
            <Funnel />
            Autonomy
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              selectedKeys={autonomyFilter}
              selectionMode="multiple"
              onSelectionChange={(keys) => {
                const next =
                  keys === "all"
                    ? autonomyModes
                    : ([...keys].map(String) as ClientAutonomy[]);

                updateSearch({ autonomy: next.length ? next : undefined });
              }}
            >
              {autonomyModes.map((mode) => (
                <Dropdown.Item key={mode} id={mode} textValue={mode}>
                  <Chip
                    color={mode === "autopilot" ? "accent" : "default"}
                    size="sm"
                    variant="soft"
                  >
                    <Chip.Label>{capitalize(mode)}</Chip.Label>
                  </Chip>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
              ))}
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
                const next =
                  keys === "all"
                    ? statuses
                    : ([...keys].map(String) as ClientStatus[]);

                updateSearch({ status: next.length ? next : undefined });
              }}
            >
              {statuses.map((status) => (
                <Dropdown.Item key={status} id={status} textValue={status}>
                  <Chip color={statusColorMap[status]} size="sm" variant="soft">
                    <CircleFill width={6} />
                    <Chip.Label>{capitalize(status)}</Chip.Label>
                  </Chip>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        {/* Sort */}
        <Dropdown>
          <Button size="sm" variant="secondary">
            <Sliders />
            Sort
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              selectedKeys={
                sortDescriptor.column
                  ? new Set([String(sortDescriptor.column)])
                  : new Set<string>()
              }
              selectionMode="single"
              onSelectionChange={(keys) => {
                const key = [...keys][0] as ClientSortColumn | undefined;

                if (!key) return;
                updateSearch({
                  sortBy: key,
                  sortDir:
                    sortDescriptor.column === key &&
                    sortDescriptor.direction === "ascending"
                      ? "desc"
                      : "asc",
                });
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <Dropdown.Item
                  key={option.id}
                  id={option.id}
                  textValue={option.label}
                >
                  <Label>{option.label}</Label>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        {/* Column visibility */}
        <Dropdown>
          <Button size="sm" variant="secondary">
            <LayoutColumns3 />
            Columns
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              disallowEmptySelection
              selectedKeys={visibleColumnSet}
              selectionMode="multiple"
              onSelectionChange={(keys) => {
                setStoredColumns(
                  keys === "all" ? [...ALL_COLUMNS] : [...keys].map(String),
                );
              }}
            >
              {COLUMN_LABELS.map((column) => (
                <Dropdown.Item
                  key={column.id}
                  id={column.id}
                  textValue={column.label}
                >
                  <Label>{column.label}</Label>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      {/* Active filters */}
      {!!(searchParams.q || autonomyActive || statusActive) && (
        <div className="flex flex-wrap items-center gap-2">
          {!!searchParams.q && (
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
          )}
          {autonomyActive
            ? [...autonomyFilter].map((mode) => (
                <Chip key={mode} size="sm" variant="secondary">
                  <Chip.Label>Autonomy: {capitalize(mode)}</Chip.Label>
                  <button
                    aria-label={`Remove ${mode} filter`}
                    className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
                    type="button"
                    onClick={() => {
                      const next = [...autonomyFilter].filter(
                        (m) => m !== mode,
                      ) as ClientAutonomy[];

                      updateSearch({
                        autonomy: next.length ? next : undefined,
                      });
                    }}
                  >
                    <Xmark className="size-3" />
                  </button>
                </Chip>
              ))
            : null}
          {statusActive
            ? [...statusFilter].map((status) => (
                <Chip key={status} size="sm" variant="secondary">
                  <Chip.Label>Status: {capitalize(status)}</Chip.Label>
                  <button
                    aria-label={`Remove ${status} filter`}
                    className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
                    type="button"
                    onClick={() => {
                      const next = [...statusFilter].filter(
                        (s) => s !== status,
                      ) as ClientStatus[];

                      updateSearch({ status: next.length ? next : undefined });
                    }}
                  >
                    <Xmark className="size-3" />
                  </button>
                </Chip>
              ))
            : null}
          <Button size="sm" variant="ghost" onPress={clearFilters}>
            Clear all
          </Button>
        </div>
      )}

      {/* Table */}
      {isPending ? (
        <TableSkeleton rows={8} />
      ) : (
        <div className="relative">
          <TableFetchingState isFetching={isFetching}>
            <DataGrid
              allowsColumnResize
              showSelectionCheckboxes
              aria-label="Clients"
              columns={columns}
              contentClassName="min-w-[1500px]"
              data={clients}
              getRowId={(item) => item.id}
              renderEmptyState={() => <div className="h-[280px]" />}
              selectedKeys={selectedKeys}
              selectionMode="multiple"
              sortDescriptor={sortDescriptor}
              variant="primary"
              onSelectionChange={setSelectedKeys}
              onSortChange={(descriptor) => {
                updateSearch({
                  sortBy: descriptor.column as ClientSortColumn,
                  sortDir:
                    descriptor.direction === "ascending" ? "asc" : "desc",
                });
              }}
            />
          </TableFetchingState>
          {/* Centered over the grid instead of inside its horizontally
            scrollable content, so it stays put when scrolling */}
          {clients.length === 0 && !isFetching && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <EmptyState className="pointer-events-auto" size="sm">
                <EmptyState.Header>
                  <EmptyState.Media className="border" variant="icon">
                    <Persons />
                  </EmptyState.Media>
                  <EmptyState.Title>No Clients Found</EmptyState.Title>
                  <EmptyState.Description>
                    No clients match your search or filters. Try adjusting them,
                    or add a new client.
                  </EmptyState.Description>
                </EmptyState.Header>
                <EmptyState.Content className="flex-row gap-2">
                  <Button variant="ghost" onPress={clearFilters}>
                    Clear Filters
                  </Button>
                  <Button variant="outline" onPress={openCreateForm}>
                    <Plus />
                    Add Client
                  </Button>
                </EmptyState.Content>
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
          <span className="text-muted">
            {selectionCount} of {count} selected
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

      {/* Bulk action bar */}
      <ActionBar aria-label="Bulk client actions" isOpen={selectionCount > 0}>
        <ActionBar.Prefix>
          <Chip size="sm" variant="soft">
            {selectionCount}
          </Chip>
        </ActionBar.Prefix>
        <ActionBar.Content>
          <Button size="sm" variant="ghost" onPress={handleExport}>
            <ArrowDownToLine />
            Export
          </Button>
          {activeSelection.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => handleSetStatus(activeSelection, "paused")}
            >
              <CirclePause />
              Pause
            </Button>
          )}
          {pausedSelection.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => handleSetStatus(pausedSelection, "active")}
            >
              <CirclePlay />
              Resume
            </Button>
          )}
          <Button
            className="text-danger"
            size="sm"
            variant="ghost"
            onPress={() => setPendingDelete(selectedClients)}
          >
            <TrashBin />
            Delete
          </Button>
        </ActionBar.Content>
        <ActionBar.Suffix>
          <Separator className="!h-5 mx-1" orientation="vertical" />
          <Button
            isIconOnly
            aria-label="Clear selection"
            size="sm"
            variant="ghost"
            onPress={() => setSelectedKeys(new Set())}
          >
            <Xmark />
          </Button>
        </ActionBar.Suffix>
      </ActionBar>

      {/* Create / edit form */}
      <ClientFormDrawer
        client={formClient}
        isOpen={formOpen}
        onOpenChange={setFormOpen}
      />

      {/* Delete confirmation */}
      <Modal
        isOpen={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[360px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-danger-soft text-danger-soft-foreground">
                  <TrashBin className="size-5" />
                </Modal.Icon>
                <Modal.Heading>
                  {pendingDelete?.length === 1
                    ? `Delete ${pendingDelete[0]?.name}?`
                    : `Delete ${pendingDelete?.length ?? 0} clients?`}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>
                  {pendingDelete?.length === 1
                    ? "This client"
                    : "These clients"}{" "}
                  will be removed from your organization, along with their
                  importer profile and bond details. This action cannot be
                  undone.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Cancel
                </Button>
                <Button
                  isPending={isDeleting}
                  variant="danger"
                  onPress={confirmDelete}
                >
                  Delete
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Row Actions
 * -----------------------------------------------------------------------------------------------*/
function RowActions({
  onDelete,
  onEdit,
}: {
  clientId: string;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <Dropdown>
      <Button isIconOnly aria-label="Row actions" size="sm" variant="tertiary">
        <EllipsisVertical />
      </Button>
      <Dropdown.Popover className="min-w-[160px]">
        <Dropdown.Menu
          onAction={(key) => {
            if (key === "edit") onEdit();
            if (key === "delete") onDelete();
          }}
        >
          <Dropdown.Item id="view" textValue="View">
            <Eye />
            <Label>View</Label>
          </Dropdown.Item>
          <Dropdown.Item id="edit" textValue="Edit">
            <Pencil />
            <Label>Edit</Label>
          </Dropdown.Item>
          <Dropdown.Item id="delete" textValue="Delete" variant="danger">
            <TrashBin className="text-danger" />
            <Label>Delete</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
