import {
  Icon3dPackage2,
  IconInboxEmpty,
  IconSparklesThree,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Avatar, Chip, Skeleton } from "@heroui/react";
import { keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";
import {
  typeMeta as actionTypeMeta,
  bucketForEvent,
} from "#/components/autopilot-log";
import { HomeCharts } from "#/components/home/home-charts";
import {
  HOME_EVENTS_PARAMS,
  HOME_LATEST_PARAMS,
  HOME_SHIPMENTS_PARAMS,
} from "#/components/home/home-params";
import {
  RowSkeletons,
  SnippetCard,
  SnippetEmpty,
} from "#/components/home/home-scaffold";
import { HomeTodo } from "#/components/home/home-todo";
import {
  priorityFor,
  StageTracker,
  statusFromApi,
  statusMeta,
} from "#/components/pipeline-board";
import type { ListShipmentsResponseDtoDataItem as ApiShipment } from "#/generated/api";
import {
  useShipmentEventsControllerFindAll,
  useShipmentsControllerFindAll,
  useShipmentsControllerStats,
  useUsersControllerGetProfile,
} from "#/generated/api";
import { getInitials } from "#/lib/format";

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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <HomeTodo className="lg:col-span-2" />
        <ActivitySnippet />
      </div>
      <LatestShipments />
      <HomeCharts />
    </div>
  );
}
