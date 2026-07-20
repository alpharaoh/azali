import {
  IconChevronRight,
  IconCircleCheck,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Avatar, Button, Chip, SearchField, Skeleton } from "@heroui/react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { addHours, formatDistanceToNowStrict } from "date-fns";
import {
  deadlineTextClass,
  deadlineTone,
  typeMeta,
} from "#/components/case-file/review-meta";
import { TableFetchingState } from "#/components/table-loading";
import { useShipmentsControllerStats } from "#/generated/api";
import { formatCurrency, getInitials } from "#/lib/format";
import { useLiveReviewItems } from "#/lib/review-items";
import type { ReviewSearch } from "#/lib/review-queue-loader";
import { REVIEW_FILTER_GROUPS } from "#/lib/review-queue-loader";
import type { ReviewItem } from "#/lib/review-types";
import { useDebouncedUrlSearch } from "#/lib/use-debounced-url-search";

/* -------------------------------------------------------------------------------------------------
 * Review queue — the triage list. Every row is a shipment waiting on a
 * broker decision; clicking one opens the shipment page, where the review
 * is worked and resolved.
 * -----------------------------------------------------------------------------------------------*/

/** First-load placeholder mirroring the QueueRow layout. */
function QueueSkeleton() {
  return (
    <ul aria-label="Loading review queue" className="flex flex-col gap-1">
      {Array.from({ length: 5 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <li key={index} className="flex items-start gap-3.5 rounded-2xl p-4">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
            <Skeleton className="h-3.5 w-2/3 rounded" />
            <Skeleton className="h-3 w-full rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Queue row — avatar · client/reference · question · value · deadline, full
 * width; the whole row is a link into the shipment page.
 * -----------------------------------------------------------------------------------------------*/
function QueueRow({
  deadline,
  item,
  onSelect,
}: {
  deadline: Date;
  item: ReviewItem;
  onSelect: () => void;
}) {
  const tone = deadlineTone(deadline);
  const TypeIcon = typeMeta[item.type].icon;

  return (
    <li>
      <button
        className="hover:bg-default/40 group flex w-full cursor-pointer items-start gap-3.5 rounded-2xl p-4 text-left transition-colors"
        type="button"
        onClick={onSelect}
      >
        <div className="relative shrink-0">
          <Avatar className="size-9">
            <Avatar.Image src={item.logo} />
            <Avatar.Fallback>{getInitials(item.client)}</Avatar.Fallback>
          </Avatar>
          <span
            className="bg-background absolute -bottom-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border"
            title={typeMeta[item.type].label}
          >
            <TypeIcon className="text-muted size-3" mode="raw" />
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-foreground truncate text-sm font-medium leading-tight">
                {item.client}
              </span>
              {item.noticeForm ? (
                <Chip color="danger" size="sm" variant="soft">
                  <Chip.Label className="font-semibold">
                    {item.noticeForm}
                  </Chip.Label>
                </Chip>
              ) : null}
              <span className="text-muted shrink-0 text-xs leading-tight">
                {item.reference}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="text-muted hidden text-xs leading-tight tabular-nums sm:inline">
                {formatCurrency(item.shipmentValue)}
              </span>
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
              <IconChevronRight className="text-muted size-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>

          <span className="text-muted line-clamp-2 text-xs leading-snug">
            {item.question}
          </span>
        </div>
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ReviewQueue
 * -----------------------------------------------------------------------------------------------*/
export function ReviewQueue() {
  const searchParams = useSearch({ strict: false }) as ReviewSearch;
  const navigate = useNavigate();
  // Filter + search live in the URL and drive the server-side query.
  const filterId = searchParams.type ?? "all";
  const { deadlines, items, isFetching, isPending } =
    useLiveReviewItems(searchParams);
  const { data: statsResponse } = useShipmentsControllerStats();

  const commitSearch = (q: string | undefined) =>
    navigate({
      replace: true,
      search: (prev: ReviewSearch) => ({ ...prev, q }),
      to: ".",
    });
  const [searchInput, setSearchInput] = useDebouncedUrlSearch(
    searchParams.q,
    commitSearch,
  );

  const deadlineFor = (item: ReviewItem) =>
    deadlines.get(item.id) ?? addHours(new Date(), item.deadlineHoursFromNow);

  const countFor = (types: readonly string[] | null) => {
    const stats = statsResponse?.data;
    if (!stats) return 0;
    if (!types) return stats.byStatus.needs_review;

    return types.reduce(
      (sum, type) => sum + (stats.byReviewType[type] ?? 0),
      0,
    );
  };

  const handleFilterChange = (id: string) => {
    navigate({
      replace: true,
      search: (prev: ReviewSearch) => ({
        ...prev,
        type: id === "all" ? undefined : (id as ReviewSearch["type"]),
      }),
      to: ".",
    });
  };

  // A filtered/searched view that comes back empty is different from a
  // genuinely clear queue.
  const isFiltered = Boolean(searchParams.q) || filterId !== "all";

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3">
      <SearchField
        aria-label="Search review items"
        value={searchInput}
        onChange={setSearchInput}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Search the queue..." />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <div className="flex flex-wrap items-center gap-1.5">
        {REVIEW_FILTER_GROUPS.map((group) => {
          const count = countFor(group.types);

          return (
            <Button
              key={group.id}
              size="sm"
              variant={filterId === group.id ? "primary" : "secondary"}
              onPress={() => handleFilterChange(group.id)}
            >
              {group.label}
              {count > 0 && (
                <Chip size="sm" variant="soft">
                  {count}
                </Chip>
              )}
            </Button>
          );
        })}
      </div>

      {isPending ? (
        <QueueSkeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border px-6 py-16 text-center">
          <div className="bg-default/60 flex size-12 items-center justify-center rounded-2xl">
            <IconCircleCheck className="text-muted size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-foreground text-base font-medium">
              {isFiltered ? "No pending items here" : "Queue clear"}
            </h2>
            <p className="text-muted max-w-[320px] text-sm">
              {isFiltered
                ? "Exceptions matching this view will show up here."
                : "Autopilot is handling everything else. New exceptions will appear here."}
            </p>
          </div>
        </div>
      ) : (
        <TableFetchingState isFetching={isFetching}>
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <QueueRow
                key={item.id}
                deadline={deadlineFor(item)}
                item={item}
                onSelect={() =>
                  navigate({
                    params: { shipmentId: item.id },
                    to: "/dashboard/shipments/$shipmentId",
                  })
                }
              />
            ))}
          </ul>
        </TableFetchingState>
      )}
    </div>
  );
}
