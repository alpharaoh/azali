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
import { useCallback, useMemo, useState } from "react";
import type { Selection, SortDescriptor } from "react-aria-components";

/* -------------------------------------------------------------------------------------------------
 * Types & Data
 * -----------------------------------------------------------------------------------------------*/
type StatusOption = "Active" | "Onboarding" | "Paused";
type AutonomyMode = "Autopilot" | "Supervised";
type PortName =
	| "LA/Long Beach"
	| "NY/NJ"
	| "Laredo"
	| "Chicago"
	| "Savannah"
	| "Houston"
	| "Miami"
	| "Seattle";

interface Country {
	name: string;
	code: string;
}

interface Client {
	id: number;
	iorNumber: string;
	bondNumber: string;
	name: string;
	origin: Country;
	industry: string;
	autonomy: AutonomyMode;
	status: StatusOption;
	entriesYtd: number;
	clientSince: string;
	ports: PortName[];
}

const companyNames = [
	"Pacific Rim Imports",
	"Bluewave Electronics",
	"Cascade Apparel Group",
	"Harbor Foods Co.",
	"Meridian Auto Parts",
	"Sunbelt Furnishings",
	"Northstar Medical Supply",
	"Coastal Toys & Games",
	"Ironclad Industrial",
	"Vela Cosmetics",
	"Summit Footwear",
	"Redwood Home Goods",
	"Atlas Machinery Corp.",
	"Lotus Textiles",
	"Golden Gate Trading",
	"Evergreen Produce Partners",
	"Titan Tools USA",
	"Aurora Lighting Co.",
	"Crestline Sporting Goods",
	"Marina Seafood Imports",
	"Pinnacle Components",
	"Silverline Packaging",
	"Oakmont Furniture Works",
	"Zenith Bike Supply",
	"Solstice Apparel",
	"Ridgeline Outdoor Gear",
	"Bayview Kitchenware",
	"Falcon Aerospace Parts",
	"Juniper Beauty Labs",
	"Stonebridge Hardware",
	"Vermilion Ceramics",
	"Halcyon Pet Supply",
	"Copperfield Instruments",
	"Windward Marine Group",
	"Larkspur Stationery",
	"Granite Peak Fitness",
	"Amber Valley Foods",
	"Cobalt Optics",
	"Fernwood Garden Supply",
	"Trailhead Luggage Co.",
	"Beacon Electrical Imports",
	"Saffron Spice Traders",
];

const industries = [
	"Apparel & Textiles",
	"Consumer Electronics",
	"Automotive Parts",
	"Food & Beverage",
	"Furniture & Home",
	"Toys & Games",
	"Industrial Equipment",
	"Cosmetics & Beauty",
	"Footwear",
	"Medical Devices",
	"Sporting Goods",
	"Hardware & Tools",
];

const origins: Country[] = [
	{ code: "cn", name: "China" },
	{ code: "vn", name: "Vietnam" },
	{ code: "mx", name: "Mexico" },
	{ code: "in", name: "India" },
	{ code: "de", name: "Germany" },
	{ code: "jp", name: "Japan" },
	{ code: "kr", name: "South Korea" },
	{ code: "tw", name: "Taiwan" },
	{ code: "it", name: "Italy" },
	{ code: "th", name: "Thailand" },
	{ code: "ca", name: "Canada" },
	{ code: "br", name: "Brazil" },
];

const allPorts: PortName[] = [
	"LA/Long Beach",
	"NY/NJ",
	"Laredo",
	"Chicago",
	"Savannah",
	"Houston",
	"Miami",
	"Seattle",
];
const statuses: StatusOption[] = ["Active", "Onboarding", "Paused"];
const autonomyModes: AutonomyMode[] = ["Autopilot", "Supervised"];

function seededRandom(seed: number) {
	const x = Math.sin(seed) * 10000;

	return x - Math.floor(x);
}

function randomDate(seed: number): string {
	const base = new Date(2023, 0, 1).getTime();
	const range = 900 * 24 * 60 * 60 * 1000;

	return new Date(base + seededRandom(seed) * range).toISOString().slice(0, 10);
}

function pickSeeded<T>(items: readonly T[], random: number): T {
	return items[Math.floor(random * items.length)] as T;
}

function randomPorts(seed: number): PortName[] {
	const count = Math.floor(seededRandom(seed) * 4) + 1;
	const shuffled = [...allPorts].sort(() => seededRandom(seed + 99) - 0.5);

	return shuffled.slice(0, count);
}

function randomIorNumber(seed: number): string {
	const prefix = Math.floor(seededRandom(seed) * 90) + 10;
	const suffix = Math.floor(seededRandom(seed + 1) * 9000000) + 1000000;

	return `${prefix}-${suffix}`;
}

function randomBondNumber(seed: number): string {
	const num = Math.floor(seededRandom(seed) * 900000000) + 100000000;

	return `99${num}`.slice(0, 9);
}

const clients: Client[] = companyNames.map((name, i) => {
	const r = (offset: number) => seededRandom(i * 7 + offset);
	const statusIndex = (i * 3 + Math.floor(r(5) * 7)) % statuses.length;

	return {
		autonomy: pickSeeded(autonomyModes, r(4)),
		bondNumber: randomBondNumber(i * 17 + 5),
		clientSince: randomDate(i * 13 + 7),
		entriesYtd: Math.floor(r(6) * 4800) + 40,
		id: i + 1,
		industry: pickSeeded(industries, r(2)),
		iorNumber: randomIorNumber(i * 13 + 1),
		name,
		origin: pickSeeded(origins, r(3)),
		ports: randomPorts(i * 11 + 3),
		status: statuses[statusIndex % statuses.length] as StatusOption,
	};
});

/* -------------------------------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------------------------*/
const statusColorMap: Record<StatusOption, "success" | "danger" | "warning"> = {
	Active: "success",
	Onboarding: "warning",
	Paused: "danger",
};

const DEFAULT_ROWS_PER_PAGE = 25;
const MAX_VISIBLE_PORTS = 3;

const ALL_COLUMNS = [
	"name",
	"iorNumber",
	"bondNumber",
	"origin",
	"industry",
	"autonomy",
	"status",
	"entriesYtd",
	"clientSince",
	"ports",
	"actions",
] as const;

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
function OriginCell({ country }: { country: Country }) {
	return (
		<span className="inline-flex items-center gap-2">
			<img
				alt={country.name}
				className="shrink-0 rounded-sm object-cover"
				height={14}
				src={`https://flagcdn.com/h20/${country.code}.png`}
				srcSet={`https://flagcdn.com/h40/${country.code}.png 2x, https://flagcdn.com/h60/${country.code}.png 3x`}
				width={20}
			/>
			<span className="text-sm">{country.name}</span>
		</span>
	);
}

/* -------------------------------------------------------------------------------------------------
 * PortsCell — inline chip list with overflow count
 * -----------------------------------------------------------------------------------------------*/
function PortsCell({ ports }: { ports: PortName[] }) {
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
	const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
	const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());
	const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
		column: "name",
		direction: "ascending",
	});
	const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
	const [autonomyFilter, setAutonomyFilter] = useState<Set<string>>(new Set());
	const [visibleColumns, setVisibleColumns] = useState<Selection>(
		new Set(ALL_COLUMNS),
	);

	const statusActive = statusFilter.size > 0;
	const autonomyActive = autonomyFilter.size > 0;

	const clearFilters = useCallback(() => {
		setSearch("");
		setAutonomyFilter(new Set());
		setStatusFilter(new Set());
		setPage(1);
	}, []);

	const filteredClients = useMemo(() => {
		let result = clients;

		if (search) {
			const q = search.toLowerCase();

			result = result.filter(
				(c) =>
					c.name.toLowerCase().includes(q) ||
					c.iorNumber.toLowerCase().includes(q) ||
					c.bondNumber.toLowerCase().includes(q),
			);
		}
		if (statusFilter.size > 0) {
			result = result.filter((c) => statusFilter.has(c.status));
		}
		if (autonomyFilter.size > 0) {
			result = result.filter((c) => autonomyFilter.has(c.autonomy));
		}

		return result;
	}, [search, statusFilter, autonomyFilter]);

	const sortedClients = useMemo(() => {
		if (!sortDescriptor.column) return filteredClients;

		return [...filteredClients].sort((a, b) => {
			const col = sortDescriptor.column as string;
			let cmp: number;

			if (col === "entriesYtd") {
				cmp = a.entriesYtd - b.entriesYtd;
			} else {
				let first: string;
				let second: string;

				if (col === "origin") {
					first = a.origin.name;
					second = b.origin.name;
				} else if (col === "ports") {
					first = a.ports.join(", ");
					second = b.ports.join(", ");
				} else {
					first = String((a as unknown as Record<string, unknown>)[col] ?? "");
					second = String((b as unknown as Record<string, unknown>)[col] ?? "");
				}

				cmp = first.localeCompare(second);
			}

			if (sortDescriptor.direction === "descending") cmp *= -1;

			return cmp;
		});
	}, [filteredClients, sortDescriptor]);

	const totalPages = Math.ceil(sortedClients.length / rowsPerPage) || 1;
	const safePage = Math.min(page, totalPages);
	const paginatedClients = useMemo(() => {
		const start = (safePage - 1) * rowsPerPage;

		return sortedClients.slice(start, start + rowsPerPage);
	}, [sortedClients, safePage, rowsPerPage]);

	const visibleColumnSet = useMemo(() => {
		if (visibleColumns === "all") return new Set<string>(ALL_COLUMNS);

		return visibleColumns as Set<string>;
	}, [visibleColumns]);

	const columns = useMemo<DataGridColumn<Client>[]>(() => {
		const allCols: DataGridColumn<Client>[] = [
			{
				accessorKey: "name",
				allowsSorting: true,
				cell: (item) => (
					<div className="flex items-center gap-3">
						<Avatar size="sm">
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
				accessorKey: "origin",
				allowsSorting: true,
				cell: (item) => <OriginCell country={item.origin} />,
				header: "Primary Origin",
				id: "origin",
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
						color={item.autonomy === "Autopilot" ? "accent" : "default"}
						size="sm"
						variant="soft"
					>
						<Chip.Label>{item.autonomy}</Chip.Label>
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
						<Chip.Label>{item.status}</Chip.Label>
					</Chip>
				),
				header: "Status",
				id: "status",
				minWidth: 110,
			},
			{
				accessorKey: "entriesYtd",
				align: "end",
				allowsSorting: true,
				cell: (item) => (
					<span className="tabular-nums">
						{item.entriesYtd.toLocaleString("en-US")}
					</span>
				),
				header: "Entries YTD",
				id: "entriesYtd",
				minWidth: 110,
			},
			{
				accessorKey: "clientSince",
				allowsSorting: true,
				cell: (item) => (
					<span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
						<Calendar className="text-muted size-3.5" />
						{formatDate(item.clientSince)}
					</span>
				),
				header: "Client Since",
				id: "clientSince",
				minWidth: 140,
			},
			{
				accessorKey: "ports",
				cell: (item) => <PortsCell ports={item.ports} />,
				header: "Ports of Entry",
				id: "ports",
				minWidth: 280,
			},
			{
				align: "end",
				cell: (item) => <RowActions clientId={item.id} />,
				header: "",
				id: "actions",
				minWidth: 50,
				pinned: "end",
				width: 50,
			},
		];

		return allCols.filter((c) => visibleColumnSet.has(c.id));
	}, [visibleColumnSet]);

	const handleSearchChange = useCallback((value: string) => {
		setSearch(value);
		setPage(1);
	}, []);

	const selectionCount =
		selectedKeys === "all"
			? sortedClients.length
			: (selectedKeys as Set<string | number>).size;

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
							{clients.length}
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
							onSelectionChange={(keys) =>
								setAutonomyFilter(
									keys === "all"
										? new Set(autonomyModes)
										: new Set([...keys].map(String)),
								)
							}
						>
							{autonomyModes.map((mode) => (
								<Dropdown.Item key={mode} id={mode} textValue={mode}>
									<Chip
										color={mode === "Autopilot" ? "accent" : "default"}
										size="sm"
										variant="soft"
									>
										<Chip.Label>{mode}</Chip.Label>
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
							onSelectionChange={(keys) =>
								setStatusFilter(
									keys === "all"
										? new Set(statuses)
										: new Set([...keys].map(String)),
								)
							}
						>
							{statuses.map((status) => (
								<Dropdown.Item key={status} id={status} textValue={status}>
									<Chip color={statusColorMap[status]} size="sm" variant="soft">
										<CircleFill width={6} />
										<Chip.Label>{status}</Chip.Label>
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
									? new Set([sortDescriptor.column])
									: new Set()
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
							<Dropdown.Item id="name" textValue="Client">
								<Label>Client</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="iorNumber" textValue="IOR #">
								<Label>IOR #</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="origin" textValue="Primary Origin">
								<Label>Primary Origin</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="industry" textValue="Industry">
								<Label>Industry</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="autonomy" textValue="Autonomy">
								<Label>Autonomy</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="status" textValue="Status">
								<Label>Status</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="entriesYtd" textValue="Entries YTD">
								<Label>Entries YTD</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="clientSince" textValue="Client Since">
								<Label>Client Since</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
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
							<Dropdown.Item id="name" textValue="Client">
								<Label>Client</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="iorNumber" textValue="IOR #">
								<Label>IOR #</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="bondNumber" textValue="Bond #">
								<Label>Bond #</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="origin" textValue="Primary Origin">
								<Label>Primary Origin</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="industry" textValue="Industry">
								<Label>Industry</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="autonomy" textValue="Autonomy">
								<Label>Autonomy</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="status" textValue="Status">
								<Label>Status</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="entriesYtd" textValue="Entries YTD">
								<Label>Entries YTD</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="clientSince" textValue="Client Since">
								<Label>Client Since</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="ports" textValue="Ports of Entry">
								<Label>Ports of Entry</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
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
									<Chip.Label>Autonomy: {mode}</Chip.Label>
									<button
										aria-label={`Remove ${mode} filter`}
										className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
										type="button"
										onClick={() => {
											const next = new Set(autonomyFilter);

											next.delete(mode);
											setAutonomyFilter(next);
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
									<Chip.Label>Status: {status}</Chip.Label>
									<button
										aria-label={`Remove ${status} filter`}
										className="text-muted hover:text-foreground ml-0.5 inline-flex cursor-pointer items-center"
										type="button"
										onClick={() => {
											const next = new Set(statusFilter);

											next.delete(status);
											setStatusFilter(next);
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
			<DataGrid
				allowsColumnResize
				showSelectionCheckboxes
				aria-label="Clients"
				columns={columns}
				contentClassName="min-w-[1500px]"
				data={paginatedClients}
				getRowId={(item) => item.id}
				renderEmptyState={() => (
					<div className="py-6">
						<EmptyState size="sm">
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
				selectedKeys={selectedKeys}
				selectionMode="multiple"
				sortDescriptor={sortDescriptor}
				variant="primary"
				onSelectionChange={setSelectedKeys}
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
								<ListBox.Item id="10" textValue="10">
									10
									<ListBox.ItemIndicator />
								</ListBox.Item>
								<ListBox.Item id="25" textValue="25">
									25
									<ListBox.ItemIndicator />
								</ListBox.Item>
								<ListBox.Item id="50" textValue="50">
									50
									<ListBox.ItemIndicator />
								</ListBox.Item>
							</ListBox>
						</InlineSelect.Popover>
					</InlineSelect>
					<Separator className="!h-4" orientation="vertical" />
					<span className="text-muted">
						{selectionCount} of {sortedClients.length} selected
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
					<Button className="text-danger" size="sm" variant="ghost">
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
function RowActions(_props: { clientId: number }) {
	return (
		<Dropdown>
			<Button isIconOnly aria-label="Row actions" size="sm" variant="tertiary">
				<EllipsisVertical />
			</Button>
			<Dropdown.Popover className="min-w-[160px]">
				<Dropdown.Menu>
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
