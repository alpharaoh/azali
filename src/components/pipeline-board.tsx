import { ChevronRight, CircleFill, Eye, Funnel } from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Chip,
  Dropdown,
  Label,
  SearchField,
} from "@heroui/react";
import type { DataGridColumn } from "@heroui-pro/react";
import { DataGrid, Widget } from "@heroui-pro/react";
import { useNavigate } from "@tanstack/react-router";
import { addHours, formatDistanceToNowStrict } from "date-fns";
import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";

import type { PipelineStage, Shipment } from "#/data/pipeline";
import { pipelineStages, shipments } from "#/data/pipeline";
import { reviewItems, useReviewDecisions } from "#/data/review-queue";

/* -------------------------------------------------------------------------------------------------
 * Derivation — a shipment's live state comes from the Review Queue store
 * -----------------------------------------------------------------------------------------------*/
type ShipmentStatus = "autopilot" | "awaiting" | "blocked" | "released";

type Row = Shipment & {
  effectiveStage: PipelineStage;
  status: ShipmentStatus;
};

const stageOrder: PipelineStage[] = [
  "intake",
  "classification",
  "compliance",
  "entry",
  "filed",
  "released",
];

function advanceStage(stage: PipelineStage): PipelineStage {
  const index = stageOrder.indexOf(stage);

  return stageOrder[Math.min(index + 1, stageOrder.length - 1)] ?? stage;
}

const statusMeta: Record<
  ShipmentStatus,
  { chip: "accent" | "default" | "success" | "warning"; label: string }
> = {
  autopilot: { chip: "accent", label: "On Autopilot" },
  awaiting: { chip: "default", label: "Awaiting CBP" },
  blocked: { chip: "warning", label: "Needs Review" },
  released: { chip: "success", label: "Released" },
};

const statusFilters: Array<{ id: string; label: string }> = [
  { id: "all", label: "All" },
  { id: "autopilot", label: "On Autopilot" },
  { id: "blocked", label: "Needs Review" },
  { id: "awaiting", label: "Awaiting CBP" },
  { id: "released", label: "Released" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

/* -------------------------------------------------------------------------------------------------
 * Stage tracker — the CI-run segments
 * -----------------------------------------------------------------------------------------------*/
function StageTracker({
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
export function PipelineBoard() {
  const navigate = useNavigate();
  const decisions = useReviewDecisions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "arrives",
    direction: "ascending",
  });

  const pendingRefs = useMemo(() => {
    return new Set(
      reviewItems
        .filter((item) => !decisions.has(item.id))
        .map((item) => item.reference),
    );
  }, [decisions]);

  const rows = useMemo<Row[]>(() => {
    return shipments.map((shipment) => {
      const isBlocked = shipment.fromReview
        ? pendingRefs.has(shipment.reference)
        : false;
      const effectiveStage =
        shipment.fromReview && !isBlocked
          ? advanceStage(shipment.stage)
          : shipment.stage;
      const status: ShipmentStatus = isBlocked
        ? "blocked"
        : effectiveStage === "released"
          ? "released"
          : effectiveStage === "filed"
            ? "awaiting"
            : "autopilot";

      return { ...shipment, effectiveStage, status };
    });
  }, [pendingRefs]);

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.status !== "released");

    return {
      active: active.length,
      autopilot: active.filter(
        (row) => row.status === "autopilot" || row.status === "awaiting",
      ).length,
      blocked: rows.filter((row) => row.status === "blocked").length,
      released: rows.filter((row) => row.status === "released").length,
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    let result = rows;

    if (search) {
      const q = search.toLowerCase();

      result = result.filter(
        (row) =>
          row.client.toLowerCase().includes(q) ||
          row.reference.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((row) => row.status === statusFilter);
    }
    if (!sortDescriptor.column) return result;

    return [...result].sort((a, b) => {
      const col = sortDescriptor.column as string;
      let cmp: number;

      if (col === "arrives") {
        cmp = a.arrivesInHours - b.arrivesInHours;
      } else if (col === "value") {
        cmp = a.value - b.value;
      } else {
        cmp = a.client.localeCompare(b.client);
      }

      if (sortDescriptor.direction === "descending") cmp *= -1;

      return cmp;
    });
  }, [rows, search, statusFilter, sortDescriptor]);

  const columns = useMemo<DataGridColumn<Row>[]>(
    () => [
      {
        accessorKey: "client",
        allowsSorting: true,
        cell: (row) => (
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              <Avatar.Fallback>{getInitials(row.client)}</Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{row.client}</span>
              <span className="text-muted text-xs tabular-nums">
                {row.reference}
              </span>
            </div>
          </div>
        ),
        header: "Shipment",
        id: "client",
        isRowHeader: true,
        minWidth: 220,
        pinned: "start",
      },
      {
        cell: (row) => (
          <div className="flex flex-col">
            <span className="whitespace-nowrap text-sm">
              {row.origin} → {row.port}
            </span>
            <span className="text-muted text-xs">{row.mode}</span>
          </div>
        ),
        header: "Route",
        id: "route",
        minWidth: 200,
      },
      {
        cell: (row) => (
          <StageTracker stage={row.effectiveStage} status={row.status} />
        ),
        header: "Stage",
        id: "stage",
        minWidth: 190,
      },
      {
        cell: (row) => (
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
            <span className="text-muted text-xs tabular-nums">
              duty {formatCurrency(row.duty)}
            </span>
          </div>
        ),
        header: "Value",
        id: "value",
        minWidth: 120,
      },
      {
        align: "end",
        cell: (row) =>
          row.status === "blocked" ? (
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => navigate({ to: "/dashboard/review" })}
            >
              <Eye />
              Review
            </Button>
          ) : (
            <Button size="sm" variant="ghost">
              Open
              <ChevronRight />
            </Button>
          ),
        header: "",
        id: "actions",
        minWidth: 120,
        pinned: "end",
      },
    ],
    [navigate],
  );

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-foreground text-xl font-semibold">Pipeline</h1>
        <p className="text-muted mt-1 max-w-2xl text-sm">
          Every shipment as a live status stream. Green flows through untouched
          — anything blocked pops to the Review Queue.
        </p>
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
          value={search}
          onChange={setSearch}
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
        <Dropdown>
          <Button size="sm" variant="secondary">
            <Funnel />
            {statusFilters.find((filter) => filter.id === statusFilter)
              ?.label ?? "All"}
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              selectedKeys={new Set([statusFilter])}
              selectionMode="single"
              onSelectionChange={(keys) => {
                const key = [...keys][0];

                setStatusFilter(key ? String(key) : "all");
              }}
            >
              {statusFilters.map((filter) => {
                const count =
                  filter.id === "all"
                    ? rows.length
                    : rows.filter((row) => row.status === filter.id).length;

                return (
                  <Dropdown.Item
                    key={filter.id}
                    id={filter.id}
                    textValue={filter.label}
                  >
                    <Label>
                      {filter.label} ({count})
                    </Label>
                    <Dropdown.ItemIndicator />
                  </Dropdown.Item>
                );
              })}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      {/* Run list */}
      <DataGrid
        aria-label="Shipment pipeline"
        columns={columns}
        contentClassName="min-w-[1100px]"
        data={visibleRows}
        getRowId={(row) => row.id}
        renderEmptyState={() => (
          <div className="text-muted py-8 text-center text-sm">
            No shipments match your filters.
          </div>
        )}
        sortDescriptor={sortDescriptor}
        variant="primary"
        onSortChange={setSortDescriptor}
      />
    </div>
  );
}
