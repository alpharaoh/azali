import {
  IconBolt,
  IconEmail1,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Avatar, Button, Chip } from "@heroui/react";
import { keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { addHours, formatDistanceToNowStrict } from "date-fns";
import {
  HOME_REVIEWS_PARAMS,
  HOME_SHIPMENTS_PARAMS,
} from "#/components/home/home-params";
import {
  RowSkeletons,
  SnippetCard,
  SnippetEmpty,
} from "#/components/home/home-scaffold";
import { priorityFor, statusFromApi } from "#/components/pipeline-board";
import type { DeadlineTone } from "#/components/review/review-detail";
import {
  deadlineTone,
  typeMeta as reviewTypeMeta,
} from "#/components/review/review-detail";
import {
  useEmailAccountsControllerList,
  useShipmentEventsControllerFindAll,
  useShipmentsControllerFindAll,
} from "#/generated/api";
import { getInitials } from "#/lib/format";
import type { ReviewRequestPayload } from "#/lib/review-items";

const deadlineTextClass: Record<DeadlineTone, string> = {
  danger: "text-danger font-medium",
  default: "text-muted",
  warning: "text-warning",
};

/** One unit of work on the list, whatever it points at. */
interface TodoItem {
  id: string;
  leading: React.ReactNode;
  title: React.ReactNode;
  detail: string;
  /** Right-aligned urgency text (review deadlines). */
  meta?: { label: string; tone: DeadlineTone };
  cta: string;
  go: () => void;
}

function TodoRow({ item }: { item: TodoItem }) {
  return (
    <div className="hover:bg-default/40 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors">
      {item.leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {item.title}
        <span className="text-muted truncate text-xs">{item.detail}</span>
      </div>
      {item.meta ? (
        <span
          className={`shrink-0 whitespace-nowrap text-xs ${deadlineTextClass[item.meta.tone]}`}
        >
          {item.meta.label}
        </span>
      ) : null}
      <Button
        className="shrink-0"
        size="sm"
        variant="secondary"
        onPress={item.go}
      >
        {item.cta}
      </Button>
    </div>
  );
}

/**
 * The broker's todo list — everything currently waiting on a human, in one
 * place: open reviews (deadline first), cargo about to land unfiled, and
 * one-time setup work. Each row carries its own CTA to the right screen.
 */
export function HomeTodo({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { data: reviewsResponse } = useShipmentsControllerFindAll(
    HOME_REVIEWS_PARAMS,
    { query: { placeholderData: keepPreviousData, refetchInterval: 10_000 } },
  );
  const { data: shipmentsResponse } = useShipmentsControllerFindAll(
    HOME_SHIPMENTS_PARAMS,
    { query: { placeholderData: keepPreviousData, refetchInterval: 10_000 } },
  );
  // The review question lives on the latest review_requested event, exactly
  // as the queue derives it (same query key — deduped with that page).
  const { data: reviewEventsResponse } = useShipmentEventsControllerFindAll(
    { limit: 200, type: ["review_requested"] },
    { query: { refetchInterval: 10_000 } },
  );
  const { data: emailAccountsResponse } = useEmailAccountsControllerList();

  // The list mixes three sources — rendering before all of them land shows
  // a todo set that reshuffles as the stragglers arrive.
  const ready = reviewsResponse && shipmentsResponse && emailAccountsResponse;

  const latestPayload = new Map<string, ReviewRequestPayload>();

  for (const event of reviewEventsResponse?.data.data ?? []) {
    if (!latestPayload.has(event.shipmentId)) {
      latestPayload.set(event.shipmentId, event.payload);
    }
  }

  const reviews = (reviewsResponse?.data.data ?? []).slice(0, 5);
  const reviewIds = new Set(
    (reviewsResponse?.data.data ?? []).map((shipment) => shipment.id),
  );

  const todos: TodoItem[] = reviews.map((shipment) => {
    const payload = latestPayload.get(shipment.id) ?? {};
    const type = payload.reviewType ?? "classification";
    const TypeIcon = reviewTypeMeta[type].icon;
    const deadline = shipment.reviewDeadlineAt
      ? new Date(shipment.reviewDeadlineAt)
      : addHours(new Date(), 24);

    return {
      id: `review-${shipment.id}`,
      leading: (
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
      ),
      title: (
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
      ),
      detail: payload.question ?? "Review required",
      meta: {
        label: formatDistanceToNowStrict(deadline),
        tone: deadlineTone(deadline),
      },
      cta: "Review",
      go: () =>
        navigate({
          to: "/dashboard/review/$itemId",
          params: { itemId: shipment.id },
        }),
    };
  });

  // Cargo about to land with no entry filed — skip anything already surfaced
  // as a review so a shipment never appears on the list twice.
  const critical = (shipmentsResponse?.data.data ?? []).filter((shipment) => {
    if (reviewIds.has(shipment.id)) return false;
    const arrivesInHours = shipment.etaAt
      ? (new Date(shipment.etaAt).getTime() - Date.now()) / 3_600_000
      : null;

    return (
      priorityFor(
        shipment.stage,
        statusFromApi[shipment.status],
        arrivesInHours,
        shipment.valueCents / 100,
      ) === 1
    );
  });

  for (const shipment of critical.slice(0, 3)) {
    todos.push({
      id: `shipment-${shipment.id}`,
      leading: (
        <div className="relative shrink-0">
          <Avatar className="size-8">
            <Avatar.Image src={shipment.client?.image ?? undefined} />
            <Avatar.Fallback>
              {getInitials(shipment.client?.name)}
            </Avatar.Fallback>
          </Avatar>
          <span
            className="bg-background absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full border"
            title="Critical shipment"
          >
            <IconBolt className="text-warning size-2.5" />
          </span>
        </div>
      ),
      title: (
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-foreground truncate text-sm font-medium">
            {shipment.client?.name ?? "Unknown client"}
          </span>
          <span className="text-muted shrink-0 text-xs">
            {shipment.reference}
          </span>
        </div>
      ),
      detail: shipment.etaAt
        ? `Entry isn't filed and cargo arrives ${formatDistanceToNowStrict(new Date(shipment.etaAt), { addSuffix: true })}`
        : "Entry isn't filed yet",
      cta: "Open",
      go: () =>
        navigate({
          to: "/dashboard/shipments/$shipmentId",
          params: { shipmentId: shipment.id },
        }),
    });
  }

  if ((emailAccountsResponse?.data.accounts ?? []).length === 0) {
    todos.push({
      id: "email-intake",
      leading: (
        <div className="bg-accent/10 text-accent flex size-8 shrink-0 items-center justify-center rounded-full">
          <IconEmail1 className="size-4" />
        </div>
      ),
      title: (
        <span className="text-foreground truncate text-sm font-medium">
          Connect email intake
        </span>
      ),
      detail: "Shipments file themselves straight from your inbox",
      cta: "Connect",
      go: () => navigate({ to: "/dashboard/settings" }),
    });
  }

  const openReviews = reviewIds.size;

  return (
    <SnippetCard
      className={className}
      linkLabel={openReviews > 0 ? "View queue" : undefined}
      title="Todo"
      onLink={
        openReviews > 0
          ? () => navigate({ to: "/dashboard/review" })
          : undefined
      }
    >
      {!ready ? (
        <RowSkeletons rows={5} />
      ) : todos.length === 0 ? (
        <SnippetEmpty
          detail="Nothing needs your attention. Autopilot is handling everything in flight."
          title="All caught up"
        />
      ) : (
        todos.map((item) => <TodoRow key={item.id} item={item} />)
      )}
    </SnippetCard>
  );
}
