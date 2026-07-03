import { Calendar, CircleFill, Eye } from "@gravity-ui/icons";
import { Button, Chip } from "@heroui/react";
import { Kanban, TrendChip, Widget } from "@heroui-pro/react";

/* -------------------------------------------------------------------------------------------------
 * Types & Data
 * -----------------------------------------------------------------------------------------------*/
interface TariffEvent {
	id: number;
	/** Plain-English headline — what a human would say is happening. */
	title: string;
	/** Regulatory citation and technical detail. */
	description: string;
	effectiveDate: string;
	/** Days until effective; null = already in effect. */
	daysOut: number | null;
	skus: number;
	clients: number;
	/** Dollar impact on clients, with a caption explaining what the number means. */
	impact: string;
	impactCaption: string;
	impactTone: "negative" | "neutral" | "positive";
}

const overviewStats = [
	{
		change: "+2",
		title: "Changes on Radar",
		trend: "neutral" as const,
		value: "5",
	},
	{
		change: "+214",
		title: "Products Affected",
		trend: "neutral" as const,
		value: "420",
	},
	{
		change: "+$113K",
		title: "Client Duty Impact",
		trend: "neutral" as const,
		value: "+$325K/yr",
	},
	{
		change: "+$17K",
		title: "Est. Fee Opportunity",
		trend: "up" as const,
		value: "$52K",
	},
];

const events: TariffEvent[] = [
	{
		clients: 6,
		daysOut: 23,
		description:
			"USTR Section 301, List 4B — 87 HTS subheadings in Chapters 84, 85 & 94.",
		effectiveDate: "2026-07-25",
		id: 1,
		impact: "+$212K/yr",
		impactCaption: "added duty for clients",
		impactTone: "negative",
		skus: 214,
		title: "Duty on consumer electronics is rising from 7.5% to 25%",
	},
	{
		clients: 1,
		daysOut: 29,
		description:
			"Section 301 exclusion on HTS 8517.62.00 — duty reverts to 25% when it lapses.",
		effectiveDate: "2026-07-31",
		id: 2,
		impact: "+$84K/yr",
		impactCaption: "added duty if not renewed",
		impactTone: "negative",
		skus: 9,
		title: "Bluewave's network equipment exemption is about to lapse",
	},
	{
		clients: 3,
		daysOut: 43,
		description:
			"Section 232 derivatives expansion — fabricated aluminum components.",
		effectiveDate: "2026-08-14",
		id: 3,
		impact: "+$67K/yr",
		impactCaption: "added duty for clients",
		impactTone: "negative",
		skus: 48,
		title: "Steel & aluminum tariffs now cover fabricated aluminum parts",
	},
	{
		clients: 4,
		daysOut: null,
		description:
			"HTS mid-year revision — heading 6404 split by upper material.",
		effectiveDate: "2026-07-01",
		id: 4,
		impact: "$0",
		impactCaption: "no duty change, codes only",
		impactTone: "neutral",
		skus: 132,
		title: "Footwear classification codes were reorganized",
	},
	{
		clients: 2,
		daysOut: null,
		description:
			"Section 301 exclusion granted on HTS 9403.20.00 — retroactive to April.",
		effectiveDate: "2026-06-20",
		id: 5,
		impact: "−$38K/yr",
		impactCaption: "savings for clients",
		impactTone: "positive",
		skus: 17,
		title: "New exemption granted — furniture clients get money back",
	},
];

const columns: Array<{
	title: string;
	indicatorClass: string;
	filter: (event: TariffEvent) => boolean;
}> = [
	{
		filter: (event) => event.daysOut !== null && event.daysOut <= 30,
		indicatorClass: "bg-danger",
		title: "Next 30 days",
	},
	{
		filter: (event) => event.daysOut !== null && event.daysOut > 30,
		indicatorClass: "bg-warning",
		title: "Next 90 days",
	},
	{
		filter: (event) => event.daysOut === null,
		indicatorClass: "bg-success",
		title: "Recently took effect",
	},
];

const impactToneClass = {
	negative: "text-danger",
	neutral: "text-foreground",
	positive: "text-emerald-600 dark:text-emerald-400",
} as const;

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/* -------------------------------------------------------------------------------------------------
 * Time-left chip
 * -----------------------------------------------------------------------------------------------*/
function TimeLeftChip({ daysOut }: { daysOut: number | null }) {
	if (daysOut === null) {
		return (
			<Chip color="success" size="sm" variant="soft">
				<CircleFill width={6} />
				<Chip.Label>In effect</Chip.Label>
			</Chip>
		);
	}

	return (
		<Chip color={daysOut <= 30 ? "danger" : "default"} size="sm" variant="soft">
			<Chip.Label>{daysOut} days left</Chip.Label>
		</Chip>
	);
}

/* -------------------------------------------------------------------------------------------------
 * Event card — time left → title → description → stats → footer
 * -----------------------------------------------------------------------------------------------*/
function TariffEventCard({ event }: { event: TariffEvent }) {
	return (
		<Kanban.Card id={event.id} textValue={event.title}>
			<div className="flex w-full flex-col gap-2.5">
				<div>
					<TimeLeftChip daysOut={event.daysOut} />
				</div>

				<span className="text-foreground text-sm font-semibold leading-snug">
					{event.title}
				</span>

				<div className="grid grid-cols-2 gap-2">
					<div className="bg-background/50 flex flex-col rounded-lg border p-2.5">
						<span
							className={`text-base font-semibold tabular-nums tracking-tight ${impactToneClass[event.impactTone]}`}
						>
							{event.impact}
						</span>
						<span className="text-muted text-xs">{event.impactCaption}</span>
					</div>
					<div className="bg-background/50 flex flex-col rounded-lg border p-2.5">
						<span className="text-foreground text-base font-semibold tabular-nums tracking-tight">
							{event.skus}
						</span>
						<span className="text-muted text-xs">
							products · {event.clients}{" "}
							{event.clients === 1 ? "client" : "clients"}
						</span>
					</div>
				</div>

				<div className="flex items-center justify-between gap-2">
					<span className="text-muted inline-flex items-center gap-1.5 text-xs">
						<Calendar className="size-3.5 shrink-0" />
						Effective {formatDate(event.effectiveDate)}
					</span>
					<Button size="sm" variant="outline">
						<Eye />
						View
					</Button>
				</div>
			</div>
		</Kanban.Card>
	);
}

/* -------------------------------------------------------------------------------------------------
 * TariffRadarOverview
 * -----------------------------------------------------------------------------------------------*/
export function TariffRadarOverview() {
	return (
		<div className="flex w-full flex-col gap-4">
			{/* Header */}
			<div>
				<h1 className="text-foreground text-xl font-semibold">Tariff Radar</h1>
				<p className="text-muted mt-1 max-w-2xl text-sm">
					When tariff rules change, we already know which client products are
					hit and what it costs them — before it takes effect. The AI re-files
					what it can and queues the rest for review.
				</p>
			</div>

			{/* Overview KPIs */}
			<Widget>
				<Widget.Header>
					<Widget.Title>Overview</Widget.Title>
				</Widget.Header>
				<Widget.Content className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{overviewStats.map((card) => (
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

			{/* Time-bucketed board */}
			<Kanban size="md">
				{columns.map((column) => {
					const columnEvents = events.filter(column.filter);

					return (
						<Kanban.Column key={column.title}>
							<Kanban.ColumnHeader>
								<Kanban.ColumnIndicator className={column.indicatorClass} />
								<Kanban.ColumnTitle>{column.title}</Kanban.ColumnTitle>
								<Kanban.ColumnCount>{columnEvents.length}</Kanban.ColumnCount>
							</Kanban.ColumnHeader>
							<Kanban.ColumnBody>
								<Kanban.CardList aria-label={column.title} items={columnEvents}>
									{(event) => <TariffEventCard event={event} />}
								</Kanban.CardList>
							</Kanban.ColumnBody>
						</Kanban.Column>
					);
				})}
			</Kanban>
		</div>
	);
}
