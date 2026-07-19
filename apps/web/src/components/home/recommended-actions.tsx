import {
  IconArrowRight,
  IconBolt,
  IconCircleCheck,
  IconClockAlert,
  IconEmail1,
  IconInboxEmpty,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Skeleton } from "@heroui/react";
import { ItemCard, ItemCardGroup } from "@heroui-pro/react";
import { keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { addHours, isBefore } from "date-fns";
import type { ComponentType } from "react";
import {
  HOME_REVIEWS_PARAMS,
  HOME_SHIPMENTS_PARAMS,
} from "#/components/home/home-params";
import { priorityFor, statusFromApi } from "#/components/pipeline-board";
import {
  useEmailAccountsControllerList,
  useShipmentsControllerFindAll,
  useShipmentsControllerStats,
} from "#/generated/api";

type ActionTone = "danger" | "warning" | "accent" | "success";

interface ActionCard {
  id: string;
  tone: ActionTone;
  icon: ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  href: string;
}

const toneClass: Record<ActionTone, string> = {
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
};

function count(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/**
 * What the broker should do next, derived from live data and ordered by
 * severity: deadlines first, then cargo about to land unfiled, then the
 * quieter housekeeping. At most three cards; an all-clear card when the
 * org is genuinely idle.
 */
export function RecommendedActions() {
  const navigate = useNavigate();
  const { data: statsResponse } = useShipmentsControllerStats({
    query: { placeholderData: keepPreviousData, refetchInterval: 10_000 },
  });
  const { data: reviewsResponse } = useShipmentsControllerFindAll(
    HOME_REVIEWS_PARAMS,
    { query: { placeholderData: keepPreviousData, refetchInterval: 10_000 } },
  );
  const { data: shipmentsResponse } = useShipmentsControllerFindAll(
    HOME_SHIPMENTS_PARAMS,
    { query: { placeholderData: keepPreviousData, refetchInterval: 10_000 } },
  );
  const { data: emailAccountsResponse } = useEmailAccountsControllerList();

  const byStatus = statsResponse?.data.byStatus;

  // Cards derive from all four sources — rendering before every one has
  // landed shows a card set that reshuffles as the stragglers arrive.
  if (
    !byStatus ||
    !reviewsResponse ||
    !shipmentsResponse ||
    !emailAccountsResponse
  ) {
    return (
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 2 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
          <div key={index} className="bg-surface flex items-center gap-3 p-4">
            <Skeleton className="size-9 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-44 rounded" />
              <Skeleton className="h-3 w-56 rounded" />
            </div>
            <Skeleton className="ml-2 size-4 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cutoff = addHours(new Date(), 24);
  const dueSoon = (reviewsResponse?.data.data ?? []).filter(
    (shipment) =>
      shipment.reviewDeadlineAt &&
      isBefore(new Date(shipment.reviewDeadlineAt), cutoff),
  ).length;

  const critical = (shipmentsResponse?.data.data ?? []).filter((shipment) => {
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
  }).length;

  const emailConnected =
    (emailAccountsResponse?.data.accounts ?? []).length > 0;

  const cards: ActionCard[] = [];

  if (dueSoon > 0) {
    cards.push({
      id: "due-soon",
      tone: "danger",
      icon: IconClockAlert,
      title: `${count(dueSoon, "review")} due within 24 hours`,
      detail: "Clear these first, the legal clock is running.",
      href: "/dashboard/review",
    });
  }
  if (critical > 0) {
    cards.push({
      id: "critical",
      tone: "warning",
      icon: IconBolt,
      title: `${count(critical, "critical shipment")} unfiled`,
      detail: "Cargo arrives soon and the entry isn't filed yet.",
      href: "/dashboard/pipeline",
    });
  }
  if (dueSoon === 0 && byStatus.needs_review > 0) {
    cards.push({
      id: "queue",
      tone: "accent",
      icon: IconInboxEmpty,
      title: `${count(byStatus.needs_review, "item")} waiting for review`,
      detail: "No deadlines pressing, work the queue when you're ready.",
      href: "/dashboard/review",
    });
  }
  if (!emailConnected) {
    cards.push({
      id: "email-intake",
      tone: "accent",
      icon: IconEmail1,
      title: "Connect email intake",
      detail: "Shipments file themselves straight from your inbox.",
      href: "/dashboard/settings",
    });
  }

  const shown = cards.slice(0, 3);

  if (shown.length === 0) {
    shown.push({
      id: "all-clear",
      tone: "success",
      icon: IconCircleCheck,
      title: "All clear",
      detail:
        "The queue is empty and autopilot is handling everything in flight.",
      href: "/dashboard/pipeline",
    });
  }

  return (
    // Titles/descriptions don't wrap, so equal-width grid tracks would
    // truncate them — let each card hug its content instead.
    <ItemCardGroup layout="grid" className="flex flex-wrap">
      {shown.map((card) => {
        const Icon = card.icon;

        return (
          <ItemCard
            key={card.id}
            className="group hover:bg-default/40 cursor-pointer p-4 transition-colors"
            role="button"
            tabIndex={0}
            onClick={() => navigate({ to: card.href })}
            onKeyDown={(event: React.KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate({ to: card.href });
              }
            }}
          >
            <ItemCard.Icon className={`rounded-xl ${toneClass[card.tone]}`}>
              <Icon className="size-4" />
            </ItemCard.Icon>
            <ItemCard.Content>
              <ItemCard.Title>{card.title}</ItemCard.Title>
              <ItemCard.Description>{card.detail}</ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
              <IconArrowRight className="text-muted size-4 transition-transform group-hover:translate-x-0.5" />
            </ItemCard.Action>
          </ItemCard>
        );
      })}
    </ItemCardGroup>
  );
}
