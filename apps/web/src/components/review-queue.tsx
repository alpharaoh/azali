import {
  IconChevronRight,
  IconCircleCheck,
} from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Avatar, Button, Chip, SearchField, Skeleton } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { addHours, formatDistanceToNowStrict } from "date-fns";
import {
  deadlineTextClass,
  deadlineTone,
  typeMeta,
} from "#/components/case-file/review-meta";
import { ConfidenceChip } from "#/components/confidence-chip";
import { TableFetchingState } from "#/components/table-loading";
import { useShipmentsControllerStats } from "#/generated/api";
import { getCountryFlag } from "#/lib/country-flag";
import { formatCurrency, getInitials } from "#/lib/format";
import { useLiveReviewItems } from "#/lib/review-items";
import type { ReviewSearch } from "#/lib/review-queue-loader";
import { REVIEW_FILTER_GROUPS } from "#/lib/review-queue-loader";
import type { ReviewItem } from "#/lib/review-types";
import { useDebouncedUrlSearch } from "#/lib/use-debounced-url-search";

/* -------------------------------------------------------------------------------------------------
 * Review queue — the triage list. Every card is a shipment waiting on a
 * broker decision; opening one lands on the shipment page, where the review
 * is worked and resolved.
 * -----------------------------------------------------------------------------------------------*/

/** One labeled fact on the card's bottom strip. */
function CardFact({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="text-muted">{label}</span>
      {children}
    </span>
  );
}

/** First-load placeholder mirroring the QueueCard layout. */
function QueueSkeleton() {
  return (
    <ul aria-label="Loading review queue" className="flex flex-col gap-2">
      {Array.from({ length: 5 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <li key={index} className="flex flex-col gap-3 rounded-2xl border p-4">
          <div className="flex items-start gap-3.5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
              <Skeleton className="h-3.5 w-2/3 rounded" />
              <Skeleton className="h-3 w-full rounded" />
            </div>
          </div>
          <div className="flex items-center gap-4 border-t pt-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-3 w-32 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Queue card — header row (who, what's at stake, when it's due) over the
 * question, with a facts strip along the bottom.
 * -----------------------------------------------------------------------------------------------*/
function QueueCard({
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
  const Flag = getCountryFlag(item.shipment.originCountry);
  const arrivesInHours = item.shipment.arrivesInHours;

  return (
    <li>
      <button
        className="hover:bg-default/40 group flex w-full cursor-pointer flex-col gap-3 rounded-2xl border p-4 text-left transition-colors"
        type="button"
        onClick={onSelect}
      >
        <div className="flex w-full items-start gap-3.5">
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
                <span className="text-foreground hidden text-xs font-medium leading-tight tabular-nums sm:inline">
                  {formatCurrency(item.shipmentValue)}
                </span>
                <span
                  className={`whitespace-nowrap text-xs leading-tight ${deadlineTextClass[tone]}`}
                >
                  due {formatDistanceToNowStrict(deadline, { addSuffix: true })}
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
        </div>

        {/* Facts strip — the review at a glance, no drill-in needed */}
        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3">
          <Chip size="sm" variant="soft">
            <TypeIcon className="size-3" />
            <Chip.Label>{typeMeta[item.type].label}</Chip.Label>
          </Chip>
          {item.proposal.value !== "—" ? (
            <CardFact label="Proposal">
              <span
                className="text-foreground max-w-[220px] truncate font-mono tabular-nums"
                title={item.proposal.value}
              >
                {item.proposal.value}
              </span>
              <ConfidenceChip confidence={item.confidence} />
            </CardFact>
          ) : null}
          {item.lineItems?.length ? (
            <CardFact label="Lines">
              <span className="text-foreground tabular-nums">
                {item.lineItems.length}
              </span>
            </CardFact>
          ) : null}
          {item.shipment.origin ? (
            <CardFact label="Origin">
              {Flag ? <Flag className="h-3 w-4 shrink-0 rounded-sm" /> : null}
              <span
                className="text-foreground max-w-[200px] truncate"
                title={item.shipment.origin}
              >
                {item.shipment.origin}
              </span>
            </CardFact>
          ) : null}
          <CardFact label="Arrives">
            {arrivesInHours === null ? (
              <span className="text-muted">No ETA</span>
            ) : (
              <span
                className={
                  arrivesInHours < 0 ? "text-muted" : "text-foreground"
                }
              >
                {formatDistanceToNowStrict(
                  addHours(new Date(), arrivesInHours),
                  { addSuffix: true },
                )}
              </span>
            )}
          </CardFact>
          {item.dutyImpact ? (
            <CardFact label="Duty">
              <span className="text-foreground tabular-nums">
                {formatCurrency(item.dutyImpact.proposed.amountUsd)}
              </span>
            </CardFact>
          ) : null}
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

  const openShipment = (shipmentId: string) =>
    navigate({
      params: { shipmentId },
      to: "/dashboard/shipments/$shipmentId",
    });

  // A filtered/searched view that comes back empty is different from a
  // genuinely clear queue.
  const isFiltered = Boolean(searchParams.q) || filterId !== "all";

  const clearFilters = () => {
    setSearchInput("");
    navigate({
      replace: true,
      search: (prev: ReviewSearch) => ({
        ...prev,
        q: undefined,
        type: undefined,
      }),
      to: ".",
    });
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-base font-medium">
              Review Queue
            </h1>
            <Chip size="sm" variant="soft">
              {countFor(null)}
            </Chip>
          </div>
          <p className="text-muted text-sm">
            Shipments waiting on a broker decision, most urgent first. Open one
            to review and resolve it.
          </p>
        </div>
      </div>

      {/* Toolbar — search, then the type filters beside it */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          aria-label="Search review items"
          value={searchInput}
          onChange={setSearchInput}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              className="w-[220px]"
              placeholder="Search the queue..."
            />
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
      </div>

      {/* Cards */}
      {isPending ? (
        <QueueSkeleton />
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border px-6 py-16">
          <EmptyState size="sm">
            <EmptyState.Header>
              <EmptyState.Media className="border" variant="icon">
                <IconCircleCheck />
              </EmptyState.Media>
              <EmptyState.Title>
                {isFiltered ? "No pending items here" : "Queue clear"}
              </EmptyState.Title>
              <EmptyState.Description>
                {isFiltered
                  ? "No reviews match your search or filters. Try adjusting them."
                  : "Autopilot is handling everything else. New exceptions will appear here."}
              </EmptyState.Description>
            </EmptyState.Header>
            {isFiltered ? (
              <EmptyState.Content className="flex-row gap-2">
                <Button variant="ghost" onPress={clearFilters}>
                  Clear Filters
                </Button>
              </EmptyState.Content>
            ) : null}
          </EmptyState>
        </div>
      ) : (
        <TableFetchingState isFetching={isFetching}>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <QueueCard
                key={item.id}
                deadline={deadlineFor(item)}
                item={item}
                onSelect={() => openShipment(item.id)}
              />
            ))}
          </ul>
        </TableFetchingState>
      )}
    </div>
  );
}
