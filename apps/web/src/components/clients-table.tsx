import {
  ArrowDownToLine,
  Calendar,
  CircleFill,
  CirclePause,
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
  Pagination,
  SearchField,
  Separator,
  Tooltip,
} from "@heroui/react";
import type { DataGridColumn } from "@heroui-pro/react";
import {
  ActionBar,
  DataGrid,
  EmptyState,
  InlineSelect,
} from "@heroui-pro/react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import * as flags from "country-flag-icons/react/3x2";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Selection, SortDescriptor } from "react-aria-components";
import { clientLogos } from "#/data/client-logos";
import type {
  ClientsControllerFindAllAutonomyItem as ClientAutonomy,
  ClientsControllerFindAllParams,
  ClientsControllerFindAllSortBy as ClientSortColumn,
  ClientsControllerFindAllStatusItem as ClientStatus,
  ListClientsResponseDtoDataItem as ApiClient,
} from "#/generated/api";
import {
  getClientsControllerFindAllQueryKey,
  useClientsControllerFindAll,
  useClientsControllerRemove,
} from "#/generated/api";
import { ROWS_PER_PAGE_OPTIONS, useRowsPerPage } from "#/lib/use-rows-per-page";

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
const SEARCH_DEBOUNCE_MS = 300;

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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  const Flag = flags[code.toUpperCase() as keyof typeof flags];

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
export function ClientsTable() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useRowsPerPage();
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [autonomyFilter, setAutonomyFilter] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Selection>(
    new Set(ALL_COLUMNS),
  );

  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS,
    );

    return () => clearTimeout(timer);
  }, [search]);

  const queryClient = useQueryClient();
  const removeClient = useClientsControllerRemove();

  const params: ClientsControllerFindAllParams = {
    search: debouncedSearch || undefined,
    status: statusFilter.size ? ([...statusFilter] as ClientStatus[]) : undefined,
    autonomy: autonomyFilter.size
      ? ([...autonomyFilter] as ClientAutonomy[])
      : undefined,
    sortBy: (sortDescriptor.column as ClientSortColumn) ?? "createdAt",
    sortDir: sortDescriptor.direction === "ascending" ? "asc" : "desc",
    limit: rowsPerPage,
    offset: (page - 1) * rowsPerPage,
  };

  const { data: response } = useClientsControllerFindAll(params, {
    query: { placeholderData: keepPreviousData },
  });

  const clients = response?.data.data ?? [];
  const count = response?.data.count ?? 0;

  const statusActive = statusFilter.size > 0;
  const autonomyActive = autonomyFilter.size > 0;

  const clearFilters = useCallback(() => {
    setSearch("");
    setAutonomyFilter(new Set());
    setStatusFilter(new Set());
    setPage(1);
  }, []);

  const handleDelete = useCallback(
    async (ids: string[]) => {
      await Promise.all(ids.map((id) => removeClient.mutateAsync({ id })));
      setSelectedKeys(new Set());
      await queryClient.invalidateQueries({
        queryKey: getClientsControllerFindAllQueryKey(),
      });
    },
    [removeClient.mutateAsync, queryClient],
  );

  const totalPages = Math.ceil(count / rowsPerPage) || 1;
  const safePage = Math.min(page, totalPages);

  const visibleColumnSet = useMemo(() => {
    if (visibleColumns === "all") return new Set<string>(ALL_COLUMNS);

    return visibleColumns as Set<string>;
  }, [visibleColumns]);

  const columns = useMemo<DataGridColumn<ApiClient>[]>(() => {
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
            onDelete={() => handleDelete([item.id])}
          />
        ),
        header: "",
        id: "actions",
        minWidth: 50,
        pinned: "end",
        width: 50,
      },
    ];

    return allCols.filter((c) => visibleColumnSet.has(c.id));
  }, [visibleColumnSet, handleDelete]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const selectionCount =
    selectedKeys === "all"
      ? clients.length
      : (selectedKeys as Set<string | number>).size;

  const selectedIds = useMemo(() => {
    if (selectedKeys === "all") return clients.map((c) => c.id);

    return [...(selectedKeys as Set<string | number>)].map(String);
  }, [selectedKeys, clients]);

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
        <Button variant="primary">
          Add Client
          <Plus />
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <SearchField
          aria-label="Search clients"
          value={search}
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
                setAutonomyFilter(
                  keys === "all"
                    ? new Set(autonomyModes)
                    : new Set([...keys].map(String)),
                );
                setPage(1);
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
                setStatusFilter(
                  keys === "all"
                    ? new Set(statuses)
                    : new Set([...keys].map(String)),
                );
                setPage(1);
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
                const key = [...keys][0] as string | undefined;

                if (!key) return;
                setSortDescriptor({
                  column: key,
                  direction:
                    sortDescriptor.column === key &&
                    sortDescriptor.direction === "ascending"
                      ? "descending"
                      : "ascending",
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
              selectedKeys={visibleColumns}
              selectionMode="multiple"
              onSelectionChange={setVisibleColumns}
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
      {!!(search || autonomyActive || statusActive) && (
        <div className="flex flex-wrap items-center gap-2">
          {!!search && (
            <Chip size="sm" variant="secondary">
              <Chip.Label>Search: {search}</Chip.Label>
              <button
                aria-label="Clear search"
                className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
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
                      const next = new Set(autonomyFilter);

                      next.delete(mode);
                      setAutonomyFilter(next);
                      setPage(1);
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
                      const next = new Set(statusFilter);

                      next.delete(status);
                      setStatusFilter(next);
                      setPage(1);
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
      <div className="relative">
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
          onSortChange={setSortDescriptor}
        />
        {/* Centered over the grid instead of inside its horizontally
            scrollable content, so it stays put when scrolling */}
        {clients.length === 0 && (
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
                <Button variant="outline">
                  <Plus />
                  Add Client
                </Button>
              </EmptyState.Content>
            </EmptyState>
          </div>
        )}
      </div>

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
          <Button size="sm" variant="ghost">
            <ArrowDownToLine />
            Export
          </Button>
          <Button size="sm" variant="ghost">
            <CirclePause />
            Pause
          </Button>
          <Button
            className="text-danger"
            size="sm"
            variant="ghost"
            onPress={() => handleDelete(selectedIds)}
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
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Row Actions
 * -----------------------------------------------------------------------------------------------*/
function RowActions({
  onDelete,
}: {
  clientId: string;
  onDelete: () => void;
}) {
  return (
    <Dropdown>
      <Button isIconOnly aria-label="Row actions" size="sm" variant="tertiary">
        <EllipsisVertical />
      </Button>
      <Dropdown.Popover className="min-w-[160px]">
        <Dropdown.Menu
          onAction={(key) => {
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
