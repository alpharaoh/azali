import {
  ArrowRight,
  Check,
  CircleDollar,
  Clock,
  FileCheck,
  FileText,
  Gear,
  Person,
  Plane,
  ScalesBalanced,
  Shield,
  ShieldExclamation,
  Sparkles,
  Tag,
  Xmark,
} from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Chip,
  Input,
  Label,
  Popover,
  TextField,
  toast,
} from "@heroui/react";
import { EmptyState, Widget } from "@heroui-pro/react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import type { ComponentType, SVGProps } from "react";
import { useMemo, useState } from "react";

import type {
  ListShipmentEventsResponseDtoDataItem as ApiEvent,
  ListShipmentsResponseDtoDataItem as ApiShipment,
} from "#/generated/api";
import {
  getShipmentEventsControllerFindAllQueryKey,
  getShipmentsControllerFindAllQueryKey,
  useShipmentEventsControllerFindAll,
  useShipmentsControllerFindAll,
  useShipmentsControllerResolveReview,
} from "#/generated/api";
import { countryName } from "#/lib/countries";
import type { ClientRef } from "#/lib/use-clients-by-id";
import { useClientsById } from "#/lib/use-clients-by-id";

/* -------------------------------------------------------------------------------------------------
 * Review payload — carried by the review_requested event
 * -----------------------------------------------------------------------------------------------*/
interface ReviewPayload {
  reviewType?: string;
  question?: string;
  confidence?: number;
  deadlineAt?: string;
  proposal?: { label: string; value: string; detail: string };
}

interface ReviewEntry {
  shipment: ApiShipment;
  client: ClientRef | undefined;
  review: ReviewPayload;
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const typeMeta: Record<string, { icon: IconComponent; label: string }> = {
  classification: { icon: Tag, label: "Classification" },
  document: { icon: FileText, label: "Document" },
  enforcement: { icon: ScalesBalanced, label: "Enforcement" },
  pga: { icon: ShieldExclamation, label: "PGA" },
  signoff: { icon: FileCheck, label: "Sign-off" },
  valuation: { icon: CircleDollar, label: "Valuation" },
};

const filterGroups = [
  { id: "all", label: "All", types: null },
  { id: "classification", label: "Classification", types: ["classification"] },
  { id: "document", label: "Documents", types: ["document"] },
  {
    id: "compliance",
    label: "Compliance",
    types: ["enforcement", "pga", "valuation"],
  },
  { id: "signoff", label: "Sign-off", types: ["signoff"] },
] as const;

type FilterId = (typeof filterGroups)[number]["id"];

const actorMeta: Record<string, { icon: IconComponent; label: string }> = {
  ai: { icon: Sparkles, label: "AI" },
  cbp: { icon: Shield, label: "CBP" },
  system: { icon: Gear, label: "System" },
  user: { icon: Person, label: "Broker" },
};

function deadlineTone(deadlineAt: string | null | undefined) {
  if (!deadlineAt) return "default" as const;
  const hours = (new Date(deadlineAt).getTime() - Date.now()) / 3_600_000;

  if (hours <= 4) return "danger" as const;
  if (hours <= 24) return "warning" as const;
  return "default" as const;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

/* -------------------------------------------------------------------------------------------------
 * ReviewQueue
 * -----------------------------------------------------------------------------------------------*/
export function ReviewQueue() {
  const queryClient = useQueryClient();
  const clientsById = useClientsById();
  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [alternate, setAlternate] = useState("");

  const { data: shipmentsResponse } = useShipmentsControllerFindAll(
    {
      status: ["needs_review"],
      sortBy: "reviewDeadlineAt",
      sortDir: "asc",
      limit: 100,
    },
    { query: { placeholderData: keepPreviousData } },
  );

  const { data: reviewEventsResponse } = useShipmentEventsControllerFindAll(
    { type: ["review_requested"], limit: 200 },
    { query: { placeholderData: keepPreviousData } },
  );

  const entries = useMemo<ReviewEntry[]>(() => {
    const shipments = shipmentsResponse?.data.data ?? [];
    const reviewEvents = reviewEventsResponse?.data.data ?? [];

    // Events arrive occurredAt desc, so the first match is the latest request.
    const latestReview = new Map<string, ReviewPayload>();

    for (const event of reviewEvents) {
      if (!latestReview.has(event.shipmentId)) {
        latestReview.set(event.shipmentId, event.payload as ReviewPayload);
      }
    }

    return shipments.map((shipment) => ({
      shipment,
      client: clientsById.get(shipment.clientId),
      review: latestReview.get(shipment.id) ?? {},
    }));
  }, [shipmentsResponse, reviewEventsResponse, clientsById]);

  const countFor = (types: readonly string[] | null) =>
    types
      ? entries.filter((entry) =>
          types.includes(entry.review.reviewType ?? ""),
        ).length
      : entries.length;

  const visible = useMemo(() => {
    const group = filterGroups.find((g) => g.id === filter);
    if (!group?.types) return entries;

    const types: readonly string[] = group.types;

    return entries.filter((entry) =>
      types.includes(entry.review.reviewType ?? ""),
    );
  }, [entries, filter]);

  const selected =
    visible.find((entry) => entry.shipment.id === selectedId) ?? visible[0];

  const { data: timelineResponse } = useShipmentEventsControllerFindAll(
    { shipmentId: selected?.shipment.id, limit: 100 },
    { query: { enabled: Boolean(selected) } },
  );
  const timeline = selected ? (timelineResponse?.data.data ?? []) : [];

  const resolveReview = useShipmentsControllerResolveReview();

  const handleResolve = (
    action: "approved" | "corrected" | "info_requested",
    alternateValue?: string,
  ) => {
    if (!selected) return;

    const reference = selected.shipment.reference;
    const run = resolveReview
      .mutateAsync({
        id: selected.shipment.id,
        data: {
          action,
          ...(alternateValue && { alternate: alternateValue }),
        },
      })
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getShipmentsControllerFindAllQueryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: getShipmentEventsControllerFindAllQueryKey(),
          }),
        ]);
        setAlternate("");
        setSelectedId(null);
      });

    toast.promise(run, {
      error: "Failed to resolve review",
      loading: "Resolving review...",
      success:
        action === "approved"
          ? `Approved ${reference}`
          : action === "corrected"
            ? `Corrected ${reference} → ${alternateValue}`
            : `Requested more info for ${reference}`,
    });
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-xl font-semibold">
              Review Queue
            </h1>
            <Chip size="sm" variant="soft">
              {entries.length}
            </Chip>
          </div>
          <p className="text-muted mt-1 max-w-2xl text-sm">
            Every decision the AI wasn't confident enough to make alone —
            resolve one and the shipment moves forward in the pipeline.
          </p>
        </div>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap items-center gap-2">
        {filterGroups.map((group) => {
          const count = countFor(group.types);

          return (
            <Button
              key={group.id}
              size="sm"
              variant={filter === group.id ? "primary" : "secondary"}
              onPress={() => setFilter(group.id)}
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

      {entries.length === 0 ? (
        <div className="py-16">
          <EmptyState size="sm">
            <EmptyState.Header>
              <EmptyState.Media className="border" variant="icon">
                <Check />
              </EmptyState.Media>
              <EmptyState.Title>Queue Clear</EmptyState.Title>
              <EmptyState.Description>
                Nothing needs review right now — the pipeline is running on
                autopilot.
              </EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(320px,380px)_1fr]">
          {/* Pending list */}
          <div className="flex flex-col gap-2">
            {visible.map((entry) => {
              const meta =
                typeMeta[entry.review.reviewType ?? ""] ??
                typeMeta.classification;
              const isSelected = selected?.shipment.id === entry.shipment.id;
              const tone = deadlineTone(entry.shipment.reviewDeadlineAt);
              const TypeIcon = meta?.icon ?? Tag;

              return (
                <button
                  key={entry.shipment.id}
                  className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-accent bg-accent-soft/30"
                      : "border-border bg-surface hover:bg-surface-secondary"
                  }`}
                  type="button"
                  onClick={() => setSelectedId(entry.shipment.id)}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      <Avatar.Image src={entry.client?.logo} />
                      <Avatar.Fallback className="text-[10px]">
                        {getInitials(entry.client?.name ?? "?")}
                      </Avatar.Fallback>
                    </Avatar>
                    <span className="text-muted truncate text-xs">
                      {entry.client?.name} · {entry.shipment.reference}
                    </span>
                  </div>
                  <span className="text-foreground line-clamp-2 text-sm font-medium">
                    {entry.review.question ?? "Review required"}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip size="sm" variant="soft">
                      <TypeIcon className="size-3" />
                      <Chip.Label>{meta?.label}</Chip.Label>
                    </Chip>
                    {entry.review.confidence !== undefined && (
                      <Chip
                        color={
                          entry.review.confidence >= 0.9 ? "success" : "warning"
                        }
                        size="sm"
                        variant="soft"
                      >
                        {Math.round(entry.review.confidence * 100)}%
                      </Chip>
                    )}
                    {entry.shipment.reviewDeadlineAt && (
                      <Chip
                        color={tone === "default" ? undefined : tone}
                        size="sm"
                        variant="soft"
                      >
                        <Clock className="size-3" />
                        <Chip.Label>
                          {formatDistanceToNowStrict(
                            new Date(entry.shipment.reviewDeadlineAt),
                            { addSuffix: true },
                          )}
                        </Chip.Label>
                      </Chip>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          {selected ? (
            <div className="flex min-w-0 flex-col gap-4">
              <Widget>
                <Widget.Header>
                  <Widget.Title>
                    {selected.review.question ?? "Review required"}
                  </Widget.Title>
                </Widget.Header>
                <Widget.Content className="flex flex-col gap-4">
                  {/* Shipment facts */}
                  <div className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="flex items-center gap-1.5">
                      {selected.shipment.transportMode === "air" ? (
                        <Plane className="size-3.5" />
                      ) : null}
                      {selected.shipment.originPort ??
                        countryName(selected.shipment.originCountry)}
                      <ArrowRight className="size-3" />
                      {selected.shipment.portOfEntry}
                    </span>
                    {selected.shipment.conveyance && (
                      <span>{selected.shipment.conveyance}</span>
                    )}
                    <span>
                      Value {formatCurrency(selected.shipment.valueCents)} ·
                      duty {formatCurrency(selected.shipment.dutyCents)}
                    </span>
                    {selected.shipment.incoterm && (
                      <span>{selected.shipment.incoterm}</span>
                    )}
                    {selected.shipment.entryType && (
                      <span>{selected.shipment.entryType}</span>
                    )}
                  </div>

                  {/* Proposal */}
                  {selected.review.proposal && (
                    <div className="border-accent bg-accent-soft/20 flex flex-col gap-1 rounded-xl border p-4">
                      <span className="text-muted text-xs font-medium uppercase tracking-wide">
                        AI Proposal — {selected.review.proposal.label}
                      </span>
                      <span className="text-foreground text-lg font-semibold">
                        {selected.review.proposal.value}
                      </span>
                      <span className="text-muted text-sm">
                        {selected.review.proposal.detail}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      isPending={resolveReview.isPending}
                      variant="primary"
                      onPress={() => handleResolve("approved")}
                    >
                      <Check />
                      Approve
                    </Button>
                    <Popover>
                      <Button variant="secondary">Correct</Button>
                      <Popover.Content className="w-80">
                        <Popover.Dialog className="flex flex-col gap-3">
                          <TextField
                            fullWidth
                            value={alternate}
                            onChange={setAlternate}
                          >
                            <Label>Corrected value</Label>
                            <Input placeholder="e.g. 8517.61.00" />
                          </TextField>
                          <Button
                            isDisabled={!alternate.trim()}
                            slot="close"
                            variant="primary"
                            onPress={() =>
                              handleResolve("corrected", alternate.trim())
                            }
                          >
                            Confirm correction
                          </Button>
                        </Popover.Dialog>
                      </Popover.Content>
                    </Popover>
                    <Button
                      variant="ghost"
                      onPress={() => handleResolve("info_requested")}
                    >
                      Request info
                    </Button>
                  </div>
                </Widget.Content>
              </Widget>

              {/* Timeline */}
              <Widget>
                <Widget.Header>
                  <Widget.Title>Timeline</Widget.Title>
                </Widget.Header>
                <Widget.Content className="flex flex-col gap-3">
                  {timeline.length === 0 ? (
                    <span className="text-muted text-sm">No events yet.</span>
                  ) : (
                    timeline.map((event: ApiEvent) => {
                      const actor = actorMeta[event.actor] ?? actorMeta.system;
                      const ActorIcon = actor?.icon ?? Gear;
                      const confidence = (
                        event.payload as { confidence?: number }
                      ).confidence;

                      return (
                        <div key={event.id} className="flex items-start gap-3">
                          <span className="bg-default text-muted mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                            <ActorIcon className="size-3" />
                          </span>
                          <div className="flex min-w-0 flex-col">
                            <span className="text-foreground text-sm">
                              {event.title}
                            </span>
                            <span className="text-muted text-xs">
                              {actor?.label} ·{" "}
                              {formatDistanceToNowStrict(
                                new Date(event.occurredAt),
                                { addSuffix: true },
                              )}
                              {confidence !== undefined &&
                                ` · ${Math.round(confidence * 100)}% confidence`}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </Widget.Content>
              </Widget>
            </div>
          ) : (
            <div className="text-muted flex items-center justify-center py-16 text-sm">
              <Xmark className="mr-2 size-4" />
              No items match this filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
