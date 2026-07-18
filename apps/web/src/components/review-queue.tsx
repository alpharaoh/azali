import { CircleCheck } from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Chip,
  ScrollShadow,
  SearchField,
  Skeleton,
  toast,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { addHours, formatDistanceToNowStrict } from "date-fns";
import { useState } from "react";
import type { DeadlineTone } from "#/components/review/review-detail";
import {
  deadlineTone,
  ReviewDetail,
  typeMeta,
} from "#/components/review/review-detail";
import { TableFetchingState } from "#/components/table-loading";
import {
  getShipmentEventsControllerFindByShipmentQueryKey,
  useShipmentEventsControllerCreate,
  useShipmentsControllerResolve,
  useShipmentsControllerStats,
} from "#/generated/api";
import { countryName } from "#/lib/countries";
import { BROKER_NOTE_TYPE } from "#/lib/event-kinds";
import { capitalize, getInitials } from "#/lib/format";
import { useLiveReviewItems } from "#/lib/review-items";
import type { ReviewSearch } from "#/lib/review-queue-loader";
import { REVIEW_FILTER_GROUPS } from "#/lib/review-queue-loader";
import type {
  Decision,
  DecisionAction,
  LineCorrection,
  ReviewItem,
} from "#/lib/review-types";
import { useCaseFile } from "#/lib/use-case-file";
import { useDebouncedUrlSearch } from "#/lib/use-debounced-url-search";

/* -------------------------------------------------------------------------------------------------
 * Meta
 * -----------------------------------------------------------------------------------------------*/

function decisionLabel(decision: Decision) {
  if (decision.action === "corrected") {
    if (decision.corrections?.length) {
      return `Corrected → ${decision.corrections.length} line${decision.corrections.length === 1 ? "" : "s"}`;
    }
    return `Corrected → ${decision.alternate}`;
  }
  if (decision.action === "info-requested") return "Info requested";

  return "Approved";
}

const deadlineTextClass: Record<DeadlineTone, string> = {
  danger: "text-danger font-medium",
  default: "text-muted",
  warning: "text-warning",
};

/** First-load placeholder mirroring the QueueRow layout. */
function QueueSkeleton() {
  return (
    <ul aria-label="Loading review queue" className="flex flex-col gap-1">
      {Array.from({ length: 5 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <li key={index} className="flex items-start gap-3.5 rounded-2xl p-4">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
            <Skeleton className="h-3.5 w-2/3 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

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
        className={`relative flex w-full cursor-pointer items-start gap-3.5 rounded-2xl p-4 text-left transition-colors ${
          isActive ? "bg-default/60" : "hover:bg-default/40"
        }`}
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
            <TypeIcon className="text-muted size-3" />
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
            </div>
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

          <span className="text-muted line-clamp-2 text-xs leading-snug">
            {item.question}
          </span>
        </div>
      </button>
    </li>
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
  const queryClient = useQueryClient();
  const params = useParams({ strict: false });
  const searchParams = useSearch({ strict: false }) as ReviewSearch;
  const navigate = useNavigate();
  // Filter + search live in the URL and drive the server-side query.
  const filterId = searchParams.type ?? "all";
  const { deadlines, items, isFetching, isPending } =
    useLiveReviewItems(searchParams);
  const { data: statsResponse } = useShipmentsControllerStats();
  const resolveReviewMutation = useShipmentsControllerResolve();
  // Selection lives in the path (/dashboard/review/<shipmentId>) so queue
  // items are deep-linkable from the pipeline board and shareable.
  const selectedId = params.itemId ?? null;
  const setSelectedId = (id: string | null) => {
    if (id) {
      navigate({
        params: { itemId: id },
        replace: true,
        search: (prev) => prev,
        to: "/dashboard/review/$itemId",
      });
    } else {
      navigate({
        replace: true,
        search: (prev) => prev,
        to: "/dashboard/review",
      });
    }
  };
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(() =>
    Boolean(params.itemId),
  );
  // Session log of what got resolved, so the "Resolved today" section keeps
  // its history after the server drops the items from the pending list.
  const [resolved, setResolved] = useState<
    Array<{ decision: Decision; item: ReviewItem }>
  >([]);

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

  const resolvedIds = new Set(resolved.map((entry) => entry.item.id));
  // The server already applied filter + search; only hide items resolved in
  // this session while the refetch is in flight.
  const visiblePending = items.filter((item) => !resolvedIds.has(item.id));
  const pending = visiblePending;

  const countFor = (types: readonly string[] | null) => {
    const stats = statsResponse?.data;
    if (!stats) return 0;
    if (!types) return stats.byStatus.needs_review;

    return types.reduce(
      (sum, type) => sum + (stats.byReviewType[type] ?? 0),
      0,
    );
  };

  const displayItem =
    visiblePending.find((item) => item.id === selectedId) ??
    visiblePending[0] ??
    null;
  const displayIndex = displayItem
    ? visiblePending.findIndex((item) => item.id === displayItem.id)
    : -1;

  // One fetch for the whole case file — split by event type at the edge.
  // Review items are settled shipments, so no polling is needed here.
  const live = useCaseFile(displayItem?.id);
  const isFileLoading = Boolean(displayItem) && live.isPending;

  const detailItem = displayItem
    ? {
        ...displayItem,
        traceRunId: displayItem.traceRunId ?? live.traceRunId,
        documents: live.documents,
        events: live.activityEvents,
        ...(live.facts && {
          shipment: {
            ...displayItem.shipment,
            origin: live.facts.originPort
              ? `${countryName(live.facts.originCountry ?? "")} (${live.facts.originPort})`
              : countryName(live.facts.originCountry ?? ""),
            port: live.facts.portOfEntry ?? displayItem.shipment.port,
            mode: live.facts.conveyance
              ? `${capitalize(live.facts.transportMode ?? "")} · ${live.facts.conveyance}`
              : capitalize(live.facts.transportMode ?? ""),
            incoterm: live.facts.incoterm ?? displayItem.shipment.incoterm,
            entryType: live.facts.entryType ?? displayItem.shipment.entryType,
          },
        }),
      }
    : null;

  const createEvent = useShipmentEventsControllerCreate();

  const handleAddNote = (body: string) => {
    if (!displayItem) return;
    const shipmentId = displayItem.id;

    createEvent
      .mutateAsync({
        shipmentId,
        data: {
          type: BROKER_NOTE_TYPE,
          actor: "user",
          title: "Broker note added to the audit record",
          payload: { body },
        },
      })
      .then(() => {
        queryClient.invalidateQueries({
          queryKey:
            getShipmentEventsControllerFindByShipmentQueryKey(shipmentId),
        });
      })
      .catch(() => {
        toast.danger("Failed to save note");
      });
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

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setIsMobileDetailOpen(true);
  };

  const handleNavigate = (direction: -1 | 1) => {
    const next = visiblePending[displayIndex + direction];

    if (next) setSelectedId(next.id);
  };

  const handleResolve = (
    action: DecisionAction,
    alternate?: string,
    corrections?: LineCorrection[],
  ) => {
    if (!displayItem) return;
    const item = displayItem;
    const next =
      visiblePending[displayIndex + 1] ??
      visiblePending[displayIndex - 1] ??
      null;

    const run = resolveReviewMutation
      .mutateAsync({
        data: {
          action: action === "info-requested" ? "info_requested" : action,
          ...(alternate && { alternate }),
          ...(corrections?.length && { corrections }),
        },
        id: item.id,
      })
      .then(async () => {
        // Everything shipment-shaped: the list, stats, the global event feed,
        // and per-shipment timelines all live under /v1/shipments.
        await queryClient.invalidateQueries({
          predicate: (query) =>
            String(query.queryKey[0]).startsWith("/v1/shipments"),
        });
      });

    toast.promise(run, {
      error: "Failed to resolve review",
      loading: "Resolving review...",
      success:
        action === "approved"
          ? `Approved ${item.reference}`
          : action === "corrected"
            ? corrections?.length
              ? `Corrected ${item.reference} — ${corrections.length} line${corrections.length === 1 ? "" : "s"}`
              : `Corrected ${item.reference} → ${alternate}`
            : `Requested more info for ${item.reference}`,
    });

    // Info requests keep the shipment in the queue server-side.
    if (action !== "info-requested") {
      setResolved((current) => [
        ...current,
        { decision: { action, alternate, corrections }, item },
      ]);
      setSelectedId(next?.id ?? null);
      if (!next) setIsMobileDetailOpen(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-24px)] min-h-[480px] w-full flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(300px,340px)_1fr] lg:gap-4">
      {/* Queue list */}
      <div
        className={`min-h-0 overflow-hidden ${
          isMobileDetailOpen
            ? "hidden lg:flex lg:flex-col"
            : "flex flex-1 flex-col"
        }`}
      >
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-clip pb-2">
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

          <ScrollShadow
            hideScrollBar
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {isPending ? (
              <QueueSkeleton />
            ) : visiblePending.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                <p className="text-foreground text-sm font-medium">
                  No pending items here
                </p>
                <p className="text-muted max-w-[220px] text-xs">
                  Exceptions matching this view will show up here.
                </p>
              </div>
            ) : (
              <TableFetchingState isFetching={isFetching}>
                <ul className="flex flex-col gap-1">
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
              </TableFetchingState>
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
        {detailItem ? (
          <ReviewDetail
            key={detailItem.id}
            deadline={deadlineFor(detailItem)}
            isFileLoading={isFileLoading}
            item={detailItem}
            notes={live.notes}
            position={displayIndex + 1}
            total={visiblePending.length}
            onAddNote={handleAddNote}
            onBack={() => setIsMobileDetailOpen(false)}
            onNavigate={handleNavigate}
            onResolve={handleResolve}
          />
        ) : isPending ? null : (
          <EmptyPane isQueueClear={pending.length === 0} />
        )}
      </div>
    </div>
  );
}
