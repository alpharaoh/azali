import {
	ArrowDownToLine,
	ArrowLeft,
	ArrowRight,
	ArrowRotateLeft,
	ArrowUpRightFromSquare,
	ChevronLeft,
	CircleCheck,
	CircleDollar,
	Envelope,
	FileCheck,
	FileText,
	Funnel,
	ShieldExclamation,
	Sparkles,
	Tag,
} from "@gravity-ui/icons";
import {
	Avatar,
	Button,
	Chip,
	Dropdown,
	Label,
	ScrollShadow,
	SearchField,
	Separator,
} from "@heroui/react";
import { ChainOfThought, Widget } from "@heroui-pro/react";
import {
	addHours,
	differenceInHours,
	formatDistanceToNowStrict,
	subHours,
} from "date-fns";
import type { ComponentType, SVGProps } from "react";
import { useMemo, useState } from "react";

import type {
	Decision,
	DecisionAction,
	DocumentLine,
	ReviewDocument,
	ReviewItem,
	ReviewItemType,
} from "#/data/review-queue";
import {
	resolveReviewItem,
	reviewItems,
	undoReviewItem,
	useReviewDecisions,
} from "#/data/review-queue";

/* -------------------------------------------------------------------------------------------------
 * Meta
 * -----------------------------------------------------------------------------------------------*/
const typeMeta: Record<
	ReviewItemType,
	{ label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
	classification: { icon: Tag, label: "Classification" },
	document: { icon: FileText, label: "Document" },
	pga: { icon: ShieldExclamation, label: "PGA" },
	signoff: { icon: FileCheck, label: "Sign-off" },
	valuation: { icon: CircleDollar, label: "Valuation" },
};

type ReviewFilter = {
	id: string;
	label: string;
	match: (type: ReviewItemType) => boolean;
};

const allFilter: ReviewFilter = { id: "all", label: "All", match: () => true };

const filters: ReviewFilter[] = [
	allFilter,
	{
		id: "classification",
		label: "Classification",
		match: (type) => type === "classification",
	},
	{ id: "document", label: "Documents", match: (type) => type === "document" },
	{
		id: "compliance",
		label: "Compliance",
		match: (type) => type === "pga" || type === "valuation",
	},
	{ id: "signoff", label: "Sign-off", match: (type) => type === "signoff" },
];

function formatCurrency(value: number) {
	return new Intl.NumberFormat("en-US", {
		currency: "USD",
		maximumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

function decisionLabel(decision: Decision) {
	if (decision.action === "corrected")
		return `Corrected → ${decision.alternate}`;
	if (decision.action === "info-requested") return "Info requested";

	return "Approved";
}

function getInitials(name: string) {
	return name
		.split(" ")
		.slice(0, 2)
		.map((part) => part[0])
		.join("");
}

type DeadlineTone = "danger" | "default" | "warning";

function deadlineTone(deadline: Date): DeadlineTone {
	const hoursLeft = differenceInHours(deadline, new Date());

	return hoursLeft <= 4 ? "danger" : hoursLeft <= 24 ? "warning" : "default";
}

const deadlineTextClass: Record<DeadlineTone, string> = {
	danger: "text-danger font-medium",
	default: "text-muted",
	warning: "text-warning",
};

/* -------------------------------------------------------------------------------------------------
 * Queue row — email-list-item structure: avatar · sender/time · subject · preview
 * -----------------------------------------------------------------------------------------------*/
function QueueRow({
	deadline,
	isActive,
	item,
	onSelect,
}: {
	deadline: Date;
	isActive: boolean;
	item: ReviewItem;
	onSelect: () => void;
}) {
	const tone = deadlineTone(deadline);
	const TypeIcon = typeMeta[item.type].icon;

	return (
		<li>
			<button
				aria-current={isActive ? "true" : undefined}
				className={`relative flex w-full cursor-pointer items-start gap-3 rounded-2xl p-3 text-left transition-colors ${
					isActive ? "bg-default/60" : "hover:bg-default/40"
				}`}
				type="button"
				onClick={onSelect}
			>
				<Avatar className="size-9 shrink-0">
					<Avatar.Fallback>{getInitials(item.client)}</Avatar.Fallback>
				</Avatar>

				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<div className="flex items-center justify-between gap-2">
						<span className="text-foreground truncate text-sm font-medium leading-tight">
							{item.client}
						</span>
						<div className="flex shrink-0 items-center gap-2">
							<span
								className={`whitespace-nowrap text-xs leading-tight ${deadlineTextClass[tone]}`}
							>
								{formatDistanceToNowStrict(deadline)}
							</span>
							{tone === "danger" ? (
								<span
									aria-hidden
									className="bg-danger size-1.5 shrink-0 rounded-full"
								/>
							) : null}
						</div>
					</div>

					<span className="text-foreground truncate text-xs font-medium leading-tight">
						{item.question}
					</span>

					<span className="text-muted truncate text-xs leading-tight">
						{item.proposal.value} — {item.proposal.detail}
					</span>

					<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
						<Chip size="sm" variant="soft">
							<TypeIcon className="size-3" />
							<Chip.Label>{typeMeta[item.type].label}</Chip.Label>
						</Chip>
						<Chip size="sm" variant="soft">
							<Chip.Label className="tabular-nums">{item.reference}</Chip.Label>
						</Chip>
					</div>
				</div>
			</button>
		</li>
	);
}

/* -------------------------------------------------------------------------------------------------
 * Shipment fact + document previews
 * -----------------------------------------------------------------------------------------------*/
function receivedAgo(hoursAgo: number) {
	return formatDistanceToNowStrict(subHours(new Date(), hoursAgo), {
		addSuffix: true,
	});
}

function ShipmentFact({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			<span className="text-muted text-xs">{label}</span>
			<span className="text-foreground truncate text-sm font-medium">
				{value}
			</span>
		</div>
	);
}

function DocumentLineRow({ line }: { line: DocumentLine }) {
	return (
		<div
			className={`flex items-baseline justify-between gap-4 rounded px-1.5 py-0.5 ${
				line.highlight ? "bg-warning/15" : ""
			}`}
		>
			<span className="text-muted shrink-0">{line.label}</span>
			<span
				className={`text-right ${
					line.highlight ? "text-foreground font-semibold" : "text-foreground"
				}`}
			>
				{line.value}
			</span>
		</div>
	);
}

function DocumentCard({ document }: { document: ReviewDocument }) {
	const Icon = document.kind === "email" ? Envelope : FileText;
	const title = document.kind === "email" ? document.subject : document.name;
	const meta =
		document.kind === "email"
			? receivedAgo(document.receivedHoursAgo)
			: `${document.meta} · ${receivedAgo(document.receivedHoursAgo)}`;
	const action =
		document.kind === "email"
			? { icon: ArrowUpRightFromSquare, label: "Open" }
			: document.kind === "scan"
				? {
						icon: ArrowUpRightFromSquare,
						label: "Open Scan",
						onPress: () => window.open(document.src, "_blank"),
					}
				: { icon: ArrowDownToLine, label: "Download" };
	const ActionIcon = action.icon;

	return (
		<Widget>
			<Widget.Header>
				<Widget.Title className="inline-flex min-w-0 items-center gap-1.5">
					<Icon className="text-muted size-3.5 shrink-0" />
					<span className="truncate">{title}</span>
				</Widget.Title>
				<div className="flex shrink-0 items-center gap-2">
					<span className="text-muted text-xs">{meta}</span>
					<Button size="sm" variant="tertiary" onPress={action.onPress}>
						<ActionIcon />
						{action.label}
					</Button>
				</div>
			</Widget.Header>
			<Widget.Content className="flex flex-col gap-2">
				{document.kind === "email" ? (
					<>
						<span className="text-muted text-xs">
							From: {document.from} · {document.meta}
						</span>
						<p className="bg-background/40 text-foreground rounded-lg border p-3 text-xs leading-relaxed">
							{document.body}
						</p>
					</>
				) : (
					<>
						{document.kind === "scan" ? (
							<>
								<a
									className="block"
									href={document.src}
									rel="noreferrer"
									target="_blank"
								>
									<img
										alt={document.name}
										className="max-h-80 w-full rounded-lg border bg-white object-contain"
										src={document.src}
									/>
								</a>
								<span className="text-muted text-xs font-medium">
									AI-extracted fields
								</span>
							</>
						) : null}
						<div className="bg-background/40 flex flex-col gap-0.5 rounded-lg border p-3 font-mono text-xs leading-relaxed">
							{(document.kind === "scan"
								? document.extracted
								: document.lines
							).map((line) => (
								<DocumentLineRow key={line.label} line={line} />
							))}
						</div>
						{document.note ? (
							<span className="text-muted inline-flex items-start gap-1.5 text-xs">
								<Sparkles className="mt-0.5 size-3 shrink-0" />
								{document.note}
							</span>
						) : null}
					</>
				)}
			</Widget.Content>
		</Widget>
	);
}

/* -------------------------------------------------------------------------------------------------
 * Detail pane — email-detail structure: toolbar · scrollable body · pinned action bar
 * -----------------------------------------------------------------------------------------------*/
function ReviewDetail({
	deadline,
	item,
	onBack,
	onNavigate,
	onResolve,
	position,
	total,
}: {
	deadline: Date;
	item: ReviewItem;
	onBack: () => void;
	onNavigate: (direction: -1 | 1) => void;
	onResolve: (action: DecisionAction, alternate?: string) => void;
	position: number;
	total: number;
}) {
	const [alternate, setAlternate] = useState<string | null>(null);
	const TypeIcon = typeMeta[item.type].icon;
	const tone = deadlineTone(deadline);

	return (
		<div className="bg-background/40 flex max-h-full min-h-0 flex-1 flex-col gap-4 overflow-clip rounded-2xl border p-4">
			{/* Toolbar */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<button
						aria-label="Back to queue"
						className="border-border text-muted hover:text-foreground inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors lg:hidden"
						type="button"
						onClick={onBack}
					>
						<ChevronLeft className="size-4" />
					</button>
					<Chip size="sm" variant="soft">
						<TypeIcon className="size-3" />
						<Chip.Label>{typeMeta[item.type].label}</Chip.Label>
					</Chip>
					<Chip
						color={tone === "default" ? "default" : tone}
						size="sm"
						variant="soft"
					>
						<Chip.Label>
							{formatDistanceToNowStrict(deadline, { addSuffix: true })}
						</Chip.Label>
					</Chip>
				</div>

				<div className="flex items-center gap-2 px-1">
					<span className="text-muted whitespace-nowrap text-xs tabular-nums">
						{position} of {total}
					</span>
					<div className="flex items-center">
						<Button
							isIconOnly
							aria-label="Previous item"
							className="text-muted hover:text-foreground"
							isDisabled={position <= 1}
							size="sm"
							variant="ghost"
							onPress={() => onNavigate(-1)}
						>
							<ArrowLeft className="size-4" />
						</Button>
						<Button
							isIconOnly
							aria-label="Next item"
							className="text-muted hover:text-foreground"
							isDisabled={position >= total}
							size="sm"
							variant="ghost"
							onPress={() => onNavigate(1)}
						>
							<ArrowRight className="size-4" />
						</Button>
					</div>
				</div>
			</div>

			{/* Body */}
			<ScrollShadow
				hideScrollBar
				className="min-h-0 flex-1 overflow-y-auto lg:px-4"
			>
				<div className="flex select-text flex-col gap-5 pb-4">
					<div className="flex flex-col gap-1">
						<h1 className="text-foreground text-base font-semibold leading-normal">
							{item.question}
						</h1>
						<span className="text-muted text-xs">
							{item.client} · {item.reference} ·{" "}
							{formatCurrency(item.shipmentValue)} shipment
						</span>
					</div>

					{/* Proposal */}
					<Widget>
						<Widget.Header>
							<Widget.Title>{item.proposal.label}</Widget.Title>
						</Widget.Header>
						<Widget.Content className="flex flex-col gap-1">
							<div className="flex items-center justify-between gap-3">
								<span className="text-foreground text-xl font-semibold tabular-nums tracking-tight">
									{item.proposal.value}
								</span>
								<Chip
									color={item.confidence >= 0.9 ? "success" : "warning"}
									size="md"
									variant="soft"
								>
									<Chip.Label>
										{Math.round(item.confidence * 100)}% confident
									</Chip.Label>
								</Chip>
							</div>
							<span className="text-muted text-sm">{item.proposal.detail}</span>
						</Widget.Content>
					</Widget>

					{/* Shipment */}
					<Widget>
						<Widget.Header>
							<Widget.Title>Shipment</Widget.Title>
						</Widget.Header>
						<Widget.Content className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
							<ShipmentFact label="Origin" value={item.shipment.origin} />
							<ShipmentFact label="Port of entry" value={item.shipment.port} />
							<ShipmentFact
								label="Arrives"
								value={formatDistanceToNowStrict(
									addHours(new Date(), item.shipment.arrivesInHours),
									{ addSuffix: true },
								)}
							/>
							<ShipmentFact label="Mode" value={item.shipment.mode} />
							<ShipmentFact label="Incoterm" value={item.shipment.incoterm} />
							<ShipmentFact
								label="Entry type"
								value={item.shipment.entryType}
							/>
						</Widget.Content>
					</Widget>

					{/* Reasoning */}
					<ChainOfThought>
						<ChainOfThought.Trigger>
							AI reasoning · {item.reasoning.length} steps
						</ChainOfThought.Trigger>
						<ChainOfThought.Content>
							<ChainOfThought.Steps>
								{item.reasoning.map((step) => (
									<ChainOfThought.Step key={step.label} label={step.label}>
										{step.body}
									</ChainOfThought.Step>
								))}
							</ChainOfThought.Steps>
						</ChainOfThought.Content>
					</ChainOfThought>

					<Separator />

					{/* Source documents */}
					<div className="flex flex-col gap-2">
						<span className="text-muted text-xs font-medium">
							Source documents
						</span>
						{item.documents.map((document) => (
							<DocumentCard
								key={
									document.kind === "email" ? document.subject : document.name
								}
								document={document}
							/>
						))}
					</div>

					{/* Comparison — when two documents disagree */}
					{item.comparison ? (
						<Widget>
							<Widget.Header>
								<Widget.Title>What differs between them</Widget.Title>
							</Widget.Header>
							<Widget.Content>
								<div className="grid grid-cols-[minmax(96px,auto)_1fr_1fr] overflow-hidden rounded-lg border text-xs">
									<div className="bg-default/40 p-2.5" />
									<div className="bg-default/40 text-foreground p-2.5 font-medium">
										{item.comparison.docA}
									</div>
									<div className="bg-default/40 text-foreground p-2.5 font-medium">
										{item.comparison.docB}
									</div>
									{item.comparison.rows.map((row) => (
										<div key={row.label} className="contents">
											<div className="text-muted border-t p-2.5">
												{row.label}
											</div>
											<div className="text-foreground border-t p-2.5">
												{row.a}
											</div>
											<div className="text-foreground border-t p-2.5">
												{row.b}
											</div>
										</div>
									))}
								</div>
							</Widget.Content>
						</Widget>
					) : null}

					{/* Alternates */}
					{item.alternates && item.alternates.length > 0 ? (
						<>
							<Separator />
							<div className="flex flex-col gap-2">
								<span className="text-muted text-xs font-medium">
									Alternate classifications
								</span>
								{item.alternates.map((alt) => {
									const isSelected = alternate === alt.value;

									return (
										<button
											key={alt.value}
											className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
												isSelected
													? "border-accent ring-accent/40 ring-1"
													: "hover:border-foreground/25"
											}`}
											type="button"
											onClick={() =>
												setAlternate(isSelected ? null : alt.value)
											}
										>
											<div className="flex flex-col">
												<span className="text-foreground text-sm font-semibold tabular-nums">
													{alt.value}
												</span>
												<span className="text-muted text-xs">{alt.detail}</span>
											</div>
											<span className="text-muted text-xs tabular-nums">
												{Math.round(alt.confidence * 100)}%
											</span>
										</button>
									);
								})}
							</div>
						</>
					) : null}
				</div>
			</ScrollShadow>

			{/* Actions — pinned below the scroll area */}
			<div className="flex items-center justify-end gap-2 border-t pt-4">
				{item.canRequestInfo ? (
					<Button variant="ghost" onPress={() => onResolve("info-requested")}>
						Request Info
					</Button>
				) : null}
				<Button
					variant="primary"
					onPress={() =>
						onResolve(
							alternate ? "corrected" : "approved",
							alternate ?? undefined,
						)
					}
				>
					<CircleCheck />
					{alternate ? `Approve ${alternate}` : item.approveLabel}
				</Button>
			</div>
		</div>
	);
}

/* -------------------------------------------------------------------------------------------------
 * Empty pane — email empty-state structure: icon tile · title · description
 * -----------------------------------------------------------------------------------------------*/
function EmptyPane({ isQueueClear }: { isQueueClear: boolean }) {
	return (
		<div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-2xl border px-6 py-16 text-center">
			<div className="bg-default/60 flex size-12 items-center justify-center rounded-2xl">
				<CircleCheck className="text-muted size-5" />
			</div>
			<div className="flex flex-col gap-1">
				<h2 className="text-foreground text-base font-semibold">
					{isQueueClear ? "Queue clear" : "Nothing selected"}
				</h2>
				<p className="text-muted max-w-[320px] text-sm">
					{isQueueClear
						? "Autopilot is handling everything else. New exceptions will appear here."
						: "Pick an item from the queue to review it here."}
				</p>
			</div>
		</div>
	);
}

/* -------------------------------------------------------------------------------------------------
 * ReviewQueue
 * -----------------------------------------------------------------------------------------------*/
export function ReviewQueue() {
	const decisions = useReviewDecisions();
	const [filterId, setFilterId] = useState("all");
	const [search, setSearch] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(
		reviewItems[0]?.id ?? null,
	);
	const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

	const deadlines = useMemo(() => {
		const now = new Date();

		return new Map(
			reviewItems.map((item) => [
				item.id,
				addHours(now, item.deadlineHoursFromNow),
			]),
		);
	}, []);

	const deadlineFor = (item: ReviewItem) =>
		deadlines.get(item.id) ?? new Date();

	const activeFilter =
		filters.find((filter) => filter.id === filterId) ?? allFilter;

	const pending = reviewItems
		.filter((item) => !decisions.has(item.id))
		.sort((a, b) => a.deadlineHoursFromNow - b.deadlineHoursFromNow);
	const query = search.trim().toLowerCase();
	const visiblePending = pending.filter(
		(item) =>
			activeFilter.match(item.type) &&
			(query.length === 0 ||
				item.question.toLowerCase().includes(query) ||
				item.client.toLowerCase().includes(query) ||
				item.reference.toLowerCase().includes(query)),
	);
	const resolved = reviewItems.flatMap((item) => {
		const decision = decisions.get(item.id);

		return decision ? [{ decision, item }] : [];
	});

	const displayItem =
		visiblePending.find((item) => item.id === selectedId) ??
		visiblePending[0] ??
		null;
	const displayIndex = displayItem
		? visiblePending.findIndex((item) => item.id === displayItem.id)
		: -1;

	const handleFilterChange = (id: string) => {
		setFilterId(id);
	};

	const handleSelect = (id: string) => {
		setSelectedId(id);
		setIsMobileDetailOpen(true);
	};

	const handleNavigate = (direction: -1 | 1) => {
		const next = visiblePending[displayIndex + direction];

		if (next) setSelectedId(next.id);
	};

	const handleResolve = (action: DecisionAction, alternate?: string) => {
		if (!displayItem) return;
		const next =
			visiblePending[displayIndex + 1] ??
			visiblePending[displayIndex - 1] ??
			null;

		resolveReviewItem(displayItem.id, { action, alternate });
		setSelectedId(next?.id ?? null);
		if (!next) setIsMobileDetailOpen(false);
	};

	const handleUndo = (id: string) => {
		undoReviewItem(id);
		if (!selectedId) setSelectedId(id);
	};

	return (
		<div className="flex h-[calc(100dvh-104px)] min-h-[480px] w-full flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(300px,340px)_1fr] lg:gap-4">
			{/* Queue list */}
			<div
				className={`min-h-0 overflow-hidden ${
					isMobileDetailOpen
						? "hidden lg:flex lg:flex-col"
						: "flex flex-1 flex-col"
				}`}
			>
				<div className="flex h-full min-h-0 flex-col gap-3 overflow-clip pb-2">
					<div className="flex items-center gap-2">
						<SearchField
							aria-label="Search review items"
							className="flex-1"
							value={search}
							onChange={setSearch}
						>
							<SearchField.Group>
								<SearchField.SearchIcon />
								<SearchField.Input placeholder="Search the queue..." />
								<SearchField.ClearButton />
							</SearchField.Group>
						</SearchField>
						<Dropdown>
							<Button size="sm" variant="secondary">
								<Funnel />
								{activeFilter.label}
							</Button>
							<Dropdown.Popover>
								<Dropdown.Menu
									selectedKeys={new Set([filterId])}
									selectionMode="single"
									onSelectionChange={(keys) => {
										const key = [...keys][0];

										handleFilterChange(key ? String(key) : "all");
									}}
								>
									{filters.map((filter) => {
										const count = pending.filter((item) =>
											filter.match(item.type),
										).length;

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

					<ScrollShadow
						hideScrollBar
						className="min-h-0 flex-1 overflow-y-auto"
					>
						{visiblePending.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
								<p className="text-foreground text-sm font-medium">
									No pending items here
								</p>
								<p className="text-muted max-w-[220px] text-xs">
									Exceptions matching this view will show up here.
								</p>
							</div>
						) : (
							<ul className="flex flex-col gap-0.5">
								{visiblePending.map((item) => (
									<QueueRow
										key={item.id}
										deadline={deadlineFor(item)}
										isActive={item.id === displayItem?.id}
										item={item}
										onSelect={() => handleSelect(item.id)}
									/>
								))}
							</ul>
						)}

						{/* Resolved today */}
						{resolved.length > 0 ? (
							<div className="mt-4 flex flex-col gap-0.5">
								<span className="text-muted px-3 pb-1 text-xs font-medium">
									Resolved today ({resolved.length})
								</span>
								{resolved.map(({ decision, item }) => (
									<div
										key={item.id}
										className="flex items-center justify-between gap-2 rounded-2xl px-3 py-2"
									>
										<div className="flex min-w-0 items-center gap-2">
											<CircleCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
											<div className="flex min-w-0 flex-col">
												<span className="text-muted truncate text-xs">
													{item.question}
												</span>
												<span className="text-muted/70 text-xs">
													{decisionLabel(decision)}
												</span>
											</div>
										</div>
										<Button
											size="sm"
											variant="ghost"
											onPress={() => handleUndo(item.id)}
										>
											<ArrowRotateLeft />
											Undo
										</Button>
									</div>
								))}
							</div>
						) : null}
					</ScrollShadow>
				</div>
			</div>

			{/* Detail */}
			<div
				className={`min-h-0 overflow-hidden ${
					isMobileDetailOpen
						? "flex flex-1 flex-col"
						: "hidden lg:flex lg:flex-col"
				}`}
			>
				{displayItem ? (
					<ReviewDetail
						key={displayItem.id}
						deadline={deadlineFor(displayItem)}
						item={displayItem}
						position={displayIndex + 1}
						total={visiblePending.length}
						onBack={() => setIsMobileDetailOpen(false)}
						onNavigate={handleNavigate}
						onResolve={handleResolve}
					/>
				) : (
					<EmptyPane isQueueClear={pending.length === 0} />
				)}
			</div>
		</div>
	);
}
