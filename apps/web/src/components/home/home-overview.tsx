import {
  Icon3dPackage2,
  IconCircleCheck,
  IconInboxEmpty,
  IconSparklesThree,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Avatar, Button, Chip, Skeleton } from "@heroui/react";
import { Widget } from "@heroui-pro/react";
import { keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { addHours, formatDistanceToNowStrict } from "date-fns";
import {
  typeMeta as actionTypeMeta,
  bucketForEvent,
} from "#/components/autopilot-log";
import { HomeCharts } from "#/components/home/home-charts";
import {
  HOME_EVENTS_PARAMS,
  HOME_LATEST_PARAMS,
  HOME_REVIEWS_PARAMS,
  HOME_SHIPMENTS_PARAMS,
} from "#/components/home/home-params";
import { RecommendedActions } from "#/components/home/recommended-actions";
import {
  priorityFor,
  StageTracker,
  statusFromApi,
  statusMeta,
} from "#/components/pipeline-board";
import type { DeadlineTone } from "#/components/review/review-detail";
import {
  deadlineTone,
  typeMeta as reviewTypeMeta,
} from "#/components/review/review-detail";
import type { ListShipmentsResponseDtoDataItem as ApiShipment } from "#/generated/api";
import {
  useShipmentEventsControllerFindAll,
  useShipmentsControllerFindAll,
  useShipmentsControllerStats,
  useUsersControllerGetProfile,
} from "#/generated/api";
import { getInitials } from "#/lib/format";
import type { ReviewRequestPayload } from "#/lib/review-items";

const deadlineTextClass: Record<DeadlineTone, string> = {
  danger: "text-danger font-medium",
  default: "text-muted",
  warning: "text-warning",
};

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
    style: "currency",
  }).format(value);
}

function count(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/* -------------------------------------------------------------------------------------------------
 * Header — the greeting plus one quiet line of where things stand
 * -----------------------------------------------------------------------------------------------*/
function greetingForHour(hour: number) {
  if (hour < 5) return "Good evening"; // small hours read as late night
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function WelcomeHeader() {
  const { data: me } = useUsersControllerGetProfile();
  const { data: statsResponse } = useShipmentsControllerStats({
    query: { placeholderData: keepPreviousData, refetchInterval: 10_000 },
  });
  const firstName = me?.data.user.name?.split(" ")[0];
  const byStatus = statsResponse?.data.byStatus;
  const inFlight = byStatus
    ? byStatus.autopilot + byStatus.needs_review + byStatus.awaiting_cbp
    : 0;

  return (
    <div className="flex flex-col gap-2 pb-3">
      {me ? (
        <h1 className="text-foreground text-3xl tracking-tight">
          {greetingForHour(new Date().getHours())}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      ) : (
        <Skeleton className="h-9 w-72 max-w-full rounded-lg" />
      )}
      {byStatus ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip size="sm" variant="soft">
            <Icon3dPackage2 className="size-3" />
            <Chip.Label>{count(inFlight, "shipment")} in flight</Chip.Label>
          </Chip>
          {/* Quiet gray until reviews actually pile up. */}
          <Chip
            color={byStatus.needs_review > 1 ? "warning" : "default"}
            size="sm"
            variant="soft"
          >
            <IconInboxEmpty className="size-3" />
            <Chip.Label>
              {count(byStatus.needs_review, "item")} awaiting your review
            </Chip.Label>
          </Chip>
          <Chip size="sm" variant="soft">
            <IconSparklesThree className="size-3" />
            <Chip.Label>
              {byStatus.autopilot + byStatus.awaiting_cbp} on autopilot
            </Chip.Label>
          </Chip>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Snippet scaffolding — every card shares the header-with-link + list shell
 * -----------------------------------------------------------------------------------------------*/
function SnippetCard({
  children,
  className,
  linkLabel,
  onLink,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  linkLabel: string;
  onLink: () => void;
  title: string;
}) {
  return (
    <Widget className={className}>
      <Widget.Header>
        <Widget.Title>{title}</Widget.Title>
        <Button
          className="text-muted"
          size="sm"
          variant="ghost"
          onPress={onLink}
        >
          {linkLabel}
        </Button>
      </Widget.Header>
      <Widget.Content className="flex flex-col">{children}</Widget.Content>
    </Widget>
  );
}

function RowSkeletons({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <div key={index} className="flex items-center gap-3 py-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/2 rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}

function SnippetEmpty({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="bg-default/60 flex size-10 items-center justify-center rounded-xl">
        <IconCircleCheck className="text-muted size-4" />
      </div>
      <span className="text-foreground text-sm font-medium">{title}</span>
      <span className="text-muted max-w-[280px] text-xs">{detail}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Review queue snippet — the five most urgent open reviews
 * -----------------------------------------------------------------------------------------------*/
function ReviewSnippet() {
  const navigate = useNavigate();
  const { data: reviewsResponse, isPending } = useShipmentsControllerFindAll(
    HOME_REVIEWS_PARAMS,
    { query: { placeholderData: keepPreviousData, refetchInterval: 10_000 } },
  );
  // The review question lives on the latest review_requested event, exactly
  // as the queue derives it (same query key — deduped with that page).
  const { data: reviewEventsResponse } = useShipmentEventsControllerFindAll(
    { limit: 200, type: ["review_requested"] },
    { query: { refetchInterval: 10_000 } },
  );

  const latestPayload = new Map<string, ReviewRequestPayload>();

  for (const event of reviewEventsResponse?.data.data ?? []) {
    if (!latestPayload.has(event.shipmentId)) {
      latestPayload.set(event.shipmentId, event.payload);
    }
  }

  const reviews = (reviewsResponse?.data.data ?? []).slice(0, 5);

  return (
    <SnippetCard
      className="lg:col-span-2"
      linkLabel="View queue"
      title="Review Queue"
      onLink={() => navigate({ to: "/dashboard/review" })}
    >
      {isPending ? (
        <RowSkeletons rows={5} />
      ) : reviews.length === 0 ? (
        <SnippetEmpty
          detail="Autopilot is handling everything else. New exceptions will appear here."
          title="Queue clear"
        />
      ) : (
        reviews.map((shipment) => {
          const payload = latestPayload.get(shipment.id) ?? {};
          const type = payload.reviewType ?? "classification";
          const TypeIcon = reviewTypeMeta[type].icon;
          const deadline = shipment.reviewDeadlineAt
            ? new Date(shipment.reviewDeadlineAt)
            : addHours(new Date(), 24);
          const tone = deadlineTone(deadline);

          return (
            <button
              key={shipment.id}
              className="hover:bg-default/40 -mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors"
              type="button"
              onClick={() =>
                navigate({
                  to: "/dashboard/review/$itemId",
                  params: { itemId: shipment.id },
                })
              }
            >
              <div className="relative shrink-0">
                <Avatar className="size-8">
                  <Avatar.Image src={shipment.client?.image ?? undefined} />
                  <Avatar.Fallback>
                    {getInitials(shipment.client?.name)}
                  </Avatar.Fallback>
                </Avatar>
                <span
                  className="bg-background absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full border"
                  title={reviewTypeMeta[type].label}
                >
                  <TypeIcon className="text-muted size-2.5" mode="raw" />
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-foreground truncate text-sm font-medium">
                    {shipment.client?.name ?? "Unknown client"}
                  </span>
                  {payload.noticeForm ? (
                    <Chip color="danger" size="sm" variant="soft">
                      <Chip.Label className="font-semibold">
                        {payload.noticeForm}
                      </Chip.Label>
                    </Chip>
                  ) : null}
                  <span className="text-muted shrink-0 text-xs">
                    {shipment.reference}
                  </span>
                </div>
                <span className="text-muted truncate text-xs">
                  {payload.question ?? "Review required"}
                </span>
              </div>
              <span
                className={`shrink-0 whitespace-nowrap text-xs ${deadlineTextClass[tone]}`}
              >
                {formatDistanceToNowStrict(deadline)}
              </span>
            </button>
          );
        })
      )}
    </SnippetCard>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Autopilot activity — the last few things the AI did unattended
 * -----------------------------------------------------------------------------------------------*/
function ActivitySnippet() {
  const navigate = useNavigate();
  const { data: eventsResponse, isPending } =
    useShipmentEventsControllerFindAll(HOME_EVENTS_PARAMS, {
      query: { placeholderData: keepPreviousData, refetchInterval: 10_000 },
    });
  const { data: shipmentsResponse } = useShipmentsControllerFindAll(
    HOME_SHIPMENTS_PARAMS,
    { query: { placeholderData: keepPreviousData, refetchInterval: 10_000 } },
  );

  const shipmentById = new Map<
    string,
    { clientName?: string; reference: string }
  >();

  for (const shipment of shipmentsResponse?.data.data ?? []) {
    shipmentById.set(shipment.id, {
      clientName: shipment.client?.name,
      reference: shipment.reference,
    });
  }

  const events = (eventsResponse?.data.data ?? []).slice(0, 6);

  return (
    <SnippetCard
      linkLabel="View logs"
      title="Recent Logs"
      onLink={() => navigate({ to: "/dashboard/autopilot" })}
    >
      {isPending ? (
        <RowSkeletons rows={5} />
      ) : events.length === 0 ? (
        <SnippetEmpty
          detail="Actions appear here as the AI works your shipments."
          title="No activity yet"
        />
      ) : (
        events.map((event) => {
          const shipment = shipmentById.get(event.shipmentId);
          const Icon =
            actionTypeMeta[bucketForEvent(event.type, event.payload)].icon;

          return (
            <button
              key={event.id}
              className="hover:bg-default/40 -mx-2 flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors"
              type="button"
              onClick={() =>
                navigate({
                  to: "/dashboard/shipments/$shipmentId",
                  params: { shipmentId: event.shipmentId },
                })
              }
            >
              <Icon className="text-muted mt-0.5 size-4 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-foreground truncate text-sm">
                  {event.title}
                </span>
                <span className="text-muted truncate text-xs">
                  {shipment?.clientName ?? "Unknown client"} ·{" "}
                  {shipment?.reference ?? "—"} ·{" "}
                  {formatDistanceToNowStrict(new Date(event.occurredAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </button>
          );
        })
      )}
    </SnippetCard>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Latest shipments — the five newest arrivals across all clients
 * -----------------------------------------------------------------------------------------------*/
function LatestShipmentRow({ shipment }: { shipment: ApiShipment }) {
  const navigate = useNavigate();
  const status = statusFromApi[shipment.status];
  const arrivesInHours = shipment.etaAt
    ? (new Date(shipment.etaAt).getTime() - Date.now()) / 3_600_000
    : null;
  const value = shipment.valueCents / 100;

  return (
    <button
      className="hover:bg-default/40 -mx-2 flex cursor-pointer items-center gap-4 rounded-lg px-2 py-2.5 text-left transition-colors"
      type="button"
      onClick={() =>
        navigate({
          to: "/dashboard/shipments/$shipmentId",
          params: { shipmentId: shipment.id },
        })
      }
    >
      <Avatar className="size-8 shrink-0">
        <Avatar.Image src={shipment.client?.image ?? undefined} />
        <Avatar.Fallback>{getInitials(shipment.client?.name)}</Avatar.Fallback>
      </Avatar>
      <div className="flex w-44 min-w-0 flex-col gap-0.5">
        <span className="text-foreground truncate text-sm font-medium">
          {shipment.client?.name ??
            (shipment.processingState ? "Extracting…" : "Unknown client")}
        </span>
        <span className="text-muted truncate text-xs">
          {shipment.reference}
        </span>
      </div>
      <div className="hidden md:block">
        <StageTracker
          priority={priorityFor(shipment.stage, status, arrivesInHours, value)}
          stage={shipment.stage}
          status={status}
        />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <span className="text-muted hidden text-xs tabular-nums sm:inline">
          {shipment.etaAt
            ? `ETA ${formatDistanceToNowStrict(new Date(shipment.etaAt), { addSuffix: true })}`
            : "No ETA"}
        </span>
        <span className="text-foreground w-16 text-right text-sm font-medium tabular-nums">
          {compactCurrency(value)}
        </span>
        <Chip color={statusMeta[status].chip} size="sm" variant="soft">
          <Chip.Label>{statusMeta[status].label}</Chip.Label>
        </Chip>
      </div>
    </button>
  );
}

function LatestShipments() {
  const navigate = useNavigate();
  const { data: latestResponse, isPending } = useShipmentsControllerFindAll(
    HOME_LATEST_PARAMS,
    { query: { placeholderData: keepPreviousData, refetchInterval: 10_000 } },
  );
  const shipments = latestResponse?.data.data ?? [];

  return (
    <SnippetCard
      linkLabel="View all"
      title="Latest Shipments"
      onLink={() => navigate({ to: "/dashboard/pipeline" })}
    >
      {isPending ? (
        <RowSkeletons rows={5} />
      ) : shipments.length === 0 ? (
        <SnippetEmpty
          detail="Connect email intake in Settings or add one from the Shipments page."
          title="No shipments yet"
        />
      ) : (
        shipments.map((shipment) => (
          <LatestShipmentRow key={shipment.id} shipment={shipment} />
        ))
      )}
    </SnippetCard>
  );
}

/* -------------------------------------------------------------------------------------------------
 * HomeOverview
 * -----------------------------------------------------------------------------------------------*/
export function HomeOverview() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
      <WelcomeHeader />
      <RecommendedActions />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ReviewSnippet />
        <ActivitySnippet />
      </div>
      <LatestShipments />
      <HomeCharts />
    </div>
  );
}
