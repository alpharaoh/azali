import {
  IconChevronRight,
  IconCircleCheck,
  IconEmail1,
  IconFileText,
  IconPaperPlane,
  IconSparklesThree,
  IconTag,
  IconUser,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Skeleton } from "@heroui/react";
import { Timeline } from "@heroui-pro/react";
import { formatDistanceToNowStrict, subHours } from "date-fns";
import type { ComponentProps, ComponentType } from "react";
import type { ActivityEvent } from "#/lib/review-types";

export function receivedAgo(hoursAgo: number) {
  return formatDistanceToNowStrict(subHours(new Date(), hoursAgo), {
    addSuffix: true,
  });
}

/**
 * Extra Timeline.Item props forwarded through our wrapper components.
 * NOTE: Timeline injects `_index`/`_isLast` only into direct children that
 * are literally `Timeline.Item` — wrappers like these never receive them,
 * so last-node connector trimming is handled by the `:last-child` rule in
 * styles.css instead.
 */
export type TimelineItemPassthrough = Partial<
  ComponentProps<typeof Timeline.Item>
>;

/**
 * Colour + icon for a timeline marker, derived from what the event means:
 * CBP correspondence is purple, classification is blue, milestones
 * (filed/released) are green, agent work is indigo, plain mail stays neutral.
 * Documents keep their neutral markers.
 */
export function eventMarker(event: ActivityEvent): {
  Icon: ComponentType<{ className?: string }>;
  className: string;
} {
  if (/\bcbp\b|form 2[89]/i.test(event.title)) {
    return {
      Icon: IconEmail1,
      className:
        "border-purple-500/40 bg-purple-500/15 text-purple-600 dark:text-purple-400",
    };
  }
  if (event.icon === "mail") {
    return {
      Icon: IconEmail1,
      className:
        "border-sky-500/40 bg-sky-500/15 text-sky-600 dark:text-sky-400",
    };
  }
  if (event.icon === "user") {
    return {
      Icon: IconUser,
      className:
        "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  if (/classif/i.test(event.title)) {
    return {
      Icon: IconTag,
      className:
        "border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-400",
    };
  }
  if (event.icon === "check") {
    return {
      Icon: IconCircleCheck,
      className:
        "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    };
  }
  if (event.icon === "ai") {
    return {
      Icon: IconSparklesThree,
      className:
        "border-indigo-500/40 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    };
  }

  return { Icon: IconPaperPlane, className: "" };
}

export function EventTimelineItem({
  event,
  onViewMemo,
  onViewTrace,
  ...rest
}: {
  event: ActivityEvent;
  onViewMemo?: () => void;
  onViewTrace?: () => void;
} & TimelineItemPassthrough) {
  const { Icon, className: markerClassName } = eventMarker(event);

  return (
    <Timeline.Item align="start" status={event.status ?? "default"} {...rest}>
      <Timeline.Marker
        aria-hidden="true"
        className={`size-6 ${markerClassName}`}
      >
        <Icon className="size-3.5" />
      </Timeline.Marker>
      <Timeline.Content className="gap-0.5">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h3 className="text-foreground m-0 min-w-0 truncate text-xs font-medium leading-5">
            {event.title}
          </h3>
          <time className="text-muted shrink-0 text-xs leading-5">
            {receivedAgo(event.occurredHoursAgo)}
          </time>
        </div>
        {event.detail ? (
          <p
            className="text-muted m-0 line-clamp-1 text-xs leading-5"
            title={event.detail}
          >
            {event.detail}
          </p>
        ) : null}
        {event.body ? (
          <div className="bg-default/40 mt-1 rounded-lg border px-3 py-2">
            <p className="text-muted m-0 line-clamp-4 whitespace-pre-line text-xs leading-5">
              {event.body}
            </p>
          </div>
        ) : null}
        <div className="flex items-center gap-4.5">
          {event.steps && onViewTrace ? (
            <button
              className="text-muted hover:text-foreground mt-0.5 inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs transition-colors"
              type="button"
              onClick={onViewTrace}
            >
              <IconSparklesThree className="size-3" />
              View agent trace
              <IconChevronRight className="size-3" />
            </button>
          ) : null}
          {event.memo && onViewMemo ? (
            <button
              className="text-muted hover:text-foreground mt-0.5 inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs transition-colors"
              type="button"
              onClick={onViewMemo}
            >
              <IconFileText className="size-3" />
              View memo
              <IconChevronRight className="size-3" />
            </button>
          ) : null}
        </div>
      </Timeline.Content>
    </Timeline.Item>
  );
}

/**
 * Placeholder mirroring the loaded activity layout: one document beat
 * (tabs bar, document pane, extraction) followed by a few event rows.
 */
export function ActivitySkeleton() {
  return (
    <output
      aria-busy="true"
      aria-label="Loading the file"
      className="flex flex-col gap-7"
    >
      <div className="flex gap-3">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24 rounded-lg" />
            <Skeleton className="h-7 w-28 rounded-lg" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Skeleton className="h-56 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-5/6 rounded" />
              <Skeleton className="h-3 w-2/3 rounded" />
              <Skeleton className="h-36 rounded-lg" />
              <Skeleton className="mt-1 h-8 w-32 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <div key={index} className="flex gap-3">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
            <Skeleton className="h-3.5 w-1/2 rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
        </div>
      ))}
    </output>
  );
}
