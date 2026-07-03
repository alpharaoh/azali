import {
	ArrowRight,
	ChevronRight,
	CircleFill,
	Eye,
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
} from "@heroui/react";
import type { DataGridColumn } from "@heroui-pro/react";
import { DataGrid, InlineSelect, Widget } from "@heroui-pro/react";
import { useNavigate } from "@tanstack/react-router";
import { addHours, formatDistanceToNowStrict } from "date-fns";
import { useMemo, useState } from "react";
import type { Selection, SortDescriptor } from "react-aria-components";

import type { PipelineStage, Shipment } from "#/data/pipeline";
import { pipelineStages, shipments } from "#/data/pipeline";
import { reviewItems, useReviewDecisions } from "#/data/review-queue";
import { ROWS_PER_PAGE_OPTIONS, useRowsPerPage } from "#/lib/use-rows-per-page";

function ShipIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
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
 * Derivation — a shipment's live state comes from the Review Queue store
 * -----------------------------------------------------------------------------------------------*/
type ShipmentStatus = "autopilot" | "awaiting" | "blocked" | "released";

type Priority = 1 | 2 | 3 | 4;

type Row = Shipment & {
	effectiveStage: PipelineStage;
	/** Null when nothing is actionable (filed / awaiting CBP / released). */
	priority: Priority | null;
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

const statusMeta: Record<
	ShipmentStatus,
	{ chip: "accent" | "default" | "success" | "warning"; label: string }
> = {
	autopilot: { chip: "accent", label: "On Autopilot" },
	awaiting: { chip: "default", label: "Awaiting CBP" },
	blocked: { chip: "warning", label: "Needs Review" },
	released: { chip: "success", label: "Released" },
};

const statusOptions: Array<{ id: ShipmentStatus; label: string }> = [
	{ id: "autopilot", label: "On Autopilot" },
	{ id: "blocked", label: "Needs Review" },
	{ id: "awaiting", label: "Awaiting CBP" },
	{ id: "released", label: "Released" },
];

const maxShipmentValue =
	Math.ceil(Math.max(...shipments.map((shipment) => shipment.value)) / 50000) *
	50000;

function compactCurrency(value: number) {
	return new Intl.NumberFormat("en-US", {
		currency: "USD",
		maximumFractionDigits: 0,
		notation: "compact",
		style: "currency",
	}).format(value);
}

function toStringSet(keys: Selection, all: string[]) {
	return keys === "all" ? new Set(all) : new Set([...keys].map(String));
}

function without<T>(set: Set<T>, value: T) {
	const next = new Set(set);

	next.delete(value);

	return next;
}

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
	const [clientFilter, setClientFilter] = useState<Set<string>>(new Set());
	const [clientQuery, setClientQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
	const [valueRange, setValueRange] = useState<[number, number]>([
		0,
		maxShipmentValue,
	]);
	const valueActive = valueRange[0] > 0 || valueRange[1] < maxShipmentValue;

	const allClients = useMemo(
		() => [...new Set(shipments.map((shipment) => shipment.client))].sort(),
		[],
	);
	const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
		column: "priority",
		direction: "ascending",
	});
	const [page, setPage] = useState(1);
	const [rowsPerPage, setRowsPerPage] = useRowsPerPage();

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

			return {
				...shipment,
				effectiveStage,
				priority: priorityFor(
					effectiveStage,
					status,
					shipment.arrivesInHours,
					shipment.value,
				),
				status,
			};
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
		if (clientFilter.size > 0) {
			result = result.filter((row) => clientFilter.has(row.client));
		}
		if (statusFilter.size > 0) {
			result = result.filter((row) => statusFilter.has(row.status));
		}
		if (valueRange[0] > 0 || valueRange[1] < maxShipmentValue) {
			result = result.filter(
				(row) => row.value >= valueRange[0] && row.value <= valueRange[1],
			);
		}
		if (!sortDescriptor.column) return result;

		return [...result].sort((a, b) => {
			const col = sortDescriptor.column as string;
			let cmp: number;

			if (col === "priority") {
				cmp =
					(a.priority ?? 5) - (b.priority ?? 5) ||
					a.arrivesInHours - b.arrivesInHours;
			} else if (col === "arrives") {
				cmp = a.arrivesInHours - b.arrivesInHours;
			} else if (col === "value") {
				cmp = a.value - b.value;
			} else {
				cmp = a.client.localeCompare(b.client);
			}

			if (sortDescriptor.direction === "descending") cmp *= -1;

			return cmp;
		});
	}, [rows, search, clientFilter, statusFilter, valueRange, sortDescriptor]);

	const statusActive = statusFilter.size > 0;

	const totalPages = Math.ceil(visibleRows.length / rowsPerPage) || 1;
	const safePage = Math.min(page, totalPages);
	const paginatedRows = useMemo(() => {
		const start = (safePage - 1) * rowsPerPage;

		return visibleRows.slice(start, start + rowsPerPage);
	}, [visibleRows, safePage, rowsPerPage]);

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
	const rangeEnd = Math.min(safePage * rowsPerPage, visibleRows.length);

	const hasActiveFilters =
		search.length > 0 || clientFilter.size > 0 || statusActive || valueActive;

	const clearFilters = () => {
		setSearch("");
		setClientFilter(new Set());
		setClientQuery("");
		setStatusFilter(new Set());
		setValueRange([0, maxShipmentValue]);
	};

	const filteredClients = clientQuery
		? allClients.filter((client) =>
				client.toLowerCase().includes(clientQuery.toLowerCase()),
			)
		: allClients;

	const columns = useMemo<DataGridColumn<Row>[]>(
		() => [
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
					const isAir = row.mode.startsWith("Air");
					const ModeIcon = isAir ? Plane : ShipIcon;
					const description = row.mode.includes("·")
						? row.mode.split("·").slice(1).join("·").trim()
						: null;
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
							className="max-h-96 overflow-y-auto"
							selectedKeys={clientFilter}
							selectionMode="multiple"
							onSelectionChange={(keys) =>
								setClientFilter(toStringSet(keys, allClients))
							}
						>
							{filteredClients.length === 0 ? (
								<Dropdown.Item id="__no-match" isDisabled textValue="No match">
									<Label>No clients match</Label>
								</Dropdown.Item>
							) : (
								filteredClients.map((client) => {
									const count = rows.filter(
										(row) => row.client === client,
									).length;

									return (
										<Dropdown.Item key={client} id={client} textValue={client}>
											<Avatar className="size-6 shrink-0">
												<Avatar.Image
													src={rows.find((r) => r.client === client)?.logo}
												/>
												<Avatar.Fallback className="text-[10px]">
													{getInitials(client)}
												</Avatar.Fallback>
											</Avatar>
											<Label>
												{client}{" "}
												{count > 1 && (
													<Chip size="sm" className="ml-1">
														{count}
													</Chip>
												)}
											</Label>
											<Dropdown.ItemIndicator />
										</Dropdown.Item>
									);
								})
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
							onSelectionChange={(keys) =>
								setStatusFilter(
									toStringSet(
										keys,
										statusOptions.map((option) => option.id),
									),
								)
							}
						>
							{statusOptions.map((option) => (
								<Dropdown.Item
									key={option.id}
									id={option.id}
									textValue={option.label}
								>
									<Chip
										color={statusMeta[option.id].chip}
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
									{compactCurrency(valueRange[0])} –{" "}
									{compactCurrency(valueRange[1])}
								</span>
							</div>
							<Slider
								aria-label="Shipment value range"
								maxValue={maxShipmentValue}
								minValue={0}
								step={5000}
								value={valueRange}
								onChange={(value) => {
									if (Array.isArray(value) && value.length === 2) {
										setValueRange(value as [number, number]);
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
								onPress={() => setValueRange([0, maxShipmentValue])}
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
										onClick={() =>
											setStatusFilter(without(statusFilter, status))
										}
									>
										<Xmark className="size-3" />
									</button>
								</Chip>
							))
						: null}
					{valueActive ? (
						<Chip size="sm" variant="secondary">
							<Chip.Label>
								Value: {compactCurrency(valueRange[0])} –{" "}
								{compactCurrency(valueRange[1])}
							</Chip.Label>
							<button
								aria-label="Remove value filter"
								className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
								type="button"
								onClick={() => setValueRange([0, maxShipmentValue])}
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
						{visibleRows.length === 0
							? "0 shipments"
							: `${rangeStart}–${rangeEnd} of ${visibleRows.length}`}
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
