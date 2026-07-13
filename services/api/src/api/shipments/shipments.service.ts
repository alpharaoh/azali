import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { deleteShipment } from "@/db/queries/delete/deleteShipment";
import { insertShipment } from "@/db/queries/insert/insertShipment";
import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import { aggregateShipmentStats } from "@/db/queries/select/many/aggregateShipmentStats";
import { listShipmentEvents } from "@/db/queries/select/many/listShipmentEvents";
import { listShipmentLineItems } from "@/db/queries/select/many/listShipmentLineItems";
import { listShipments } from "@/db/queries/select/many/listShipments";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import { updateProduct } from "@/db/queries/update/updateProduct";
import { updateShipment } from "@/db/queries/update/updateShipment";
import { updateShipmentLineItem } from "@/db/queries/update/updateShipmentLineItem";
import { LineItemStatus } from "@/db/schemas/shipmentLineItems";
import { ShipmentStage, ShipmentStatus } from "@/db/schemas/shipments";
import { inngest } from "@/inngest/client";
import { SHIPMENT_CLASSIFY_REQUESTED_EVENT } from "@/inngest/functions/classifyShipment";
import type { CreateShipmentDto } from "./dto/create-shipment.dto";
import type { ListShipmentsDto } from "./dto/list-shipments.dto";
import {
  type ResolveReviewDto,
  ReviewResolutionAction,
} from "./dto/resolve-review.dto";
import type { UpdateShipmentDto } from "./dto/update-shipment.dto";

const STAGE_ORDER: ShipmentStage[] = [
  ShipmentStage.Intake,
  ShipmentStage.Classification,
  ShipmentStage.Compliance,
  ShipmentStage.Entry,
  ShipmentStage.Filed,
  ShipmentStage.Released,
];

function advanceStage(stage: ShipmentStage): ShipmentStage {
  const index = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[Math.min(index + 1, STAGE_ORDER.length - 1)] ?? stage;
}

function statusForStage(stage: ShipmentStage): ShipmentStatus {
  if (stage === ShipmentStage.Released) return ShipmentStatus.Released;
  if (stage === ShipmentStage.Filed) return ShipmentStatus.AwaitingCbp;
  return ShipmentStatus.Autopilot;
}

function toInsertValues<T extends { etaAt?: string | null }>(dto: T) {
  const { etaAt, ...rest } = dto;

  return {
    ...rest,
    ...(etaAt !== undefined && { etaAt: etaAt ? new Date(etaAt) : null }),
  };
}

@Injectable()
export class ShipmentsService {
  async create(organizationId: string, userId: string, dto: CreateShipmentDto) {
    return insertShipment({
      ...toInsertValues(dto),
      organizationId,
      userId,
    });
  }

  async findAll(organizationId: string, query: ListShipmentsDto) {
    const {
      limit,
      offset,
      sortBy,
      sortDir,
      search,
      stage,
      status,
      clientId,
      reviewType,
      valueMin,
      valueMax,
    } = query;

    return listShipments(
      {
        organizationId,
        search,
        stages: stage,
        statuses: status,
        clientIds: clientId,
        reviewTypes: reviewType,
        valueMinCents: valueMin,
        valueMaxCents: valueMax,
      },
      { [sortBy]: sortDir },
      limit,
      offset,
    );
  }

  async stats(organizationId: string) {
    const rows = await aggregateShipmentStats(organizationId);
    const byStatus: Record<ShipmentStatus, number> = {
      [ShipmentStatus.Autopilot]: 0,
      [ShipmentStatus.NeedsReview]: 0,
      [ShipmentStatus.AwaitingCbp]: 0,
      [ShipmentStatus.Released]: 0,
    };
    const byReviewType: Record<string, number> = {};
    let total = 0;

    for (const row of rows) {
      total += row.count;
      byStatus[row.status] += row.count;
      if (row.reviewType) {
        byReviewType[row.reviewType] =
          (byReviewType[row.reviewType] ?? 0) + row.count;
      }
    }

    return { byReviewType, byStatus, total };
  }

  async findOne(organizationId: string, id: string) {
    const shipment = await selectShipment(id, organizationId);
    if (!shipment) {
      throw new NotFoundException(`Shipment "${id}" not found`);
    }

    return shipment;
  }

  async update(organizationId: string, id: string, dto: UpdateShipmentDto) {
    const shipment = await updateShipment(
      id,
      organizationId,
      toInsertValues(dto),
    );
    if (!shipment) {
      throw new NotFoundException(`Shipment "${id}" not found`);
    }

    return shipment;
  }

  async remove(organizationId: string, id: string) {
    const shipment = await deleteShipment(id, organizationId);
    if (!shipment) {
      throw new NotFoundException(`Shipment "${id}" not found`);
    }

    return shipment;
  }

  /**
   * Resolve the open review on a shipment: append a review_resolved event
   * (audit trail), then advance the stage and recompute the denormalized
   * status columns. "info_requested" keeps the shipment in the queue.
   */
  async resolveReview(
    organizationId: string,
    userId: string,
    id: string,
    dto: ResolveReviewDto,
  ) {
    const shipment = await this.findOne(organizationId, id);

    if (shipment.status !== ShipmentStatus.NeedsReview) {
      throw new ConflictException(
        `Shipment "${id}" has no pending review to resolve`,
      );
    }

    const titles: Record<ReviewResolutionAction, string> = {
      [ReviewResolutionAction.Approved]: "Review approved",
      [ReviewResolutionAction.Corrected]: `Review corrected${dto.alternate ? ` → ${dto.alternate}` : ""}`,
      [ReviewResolutionAction.InfoRequested]: "More information requested",
    };

    await insertShipmentEvent({
      organizationId,
      userId,
      shipmentId: shipment.id,
      type: "review_resolved",
      actor: "user",
      title: titles[dto.action],
      payload: {
        action: dto.action,
        ...(dto.alternate && { alternate: dto.alternate }),
        ...(dto.note && { note: dto.note }),
      },
    });

    if (dto.action === ReviewResolutionAction.InfoRequested) {
      return shipment;
    }

    await this.applyResolutionToLines(organizationId, id, dto);

    const nextStage = advanceStage(shipment.stage);

    const updated = await updateShipment(id, organizationId, {
      stage: nextStage,
      status: statusForStage(nextStage),
      reviewDeadlineAt: null,
      reviewType: null,
    });

    return updated ?? shipment;
  }

  /**
   * Land the resolution on the line items and product library: the reviewed
   * line is approved or corrected (a correction also updates the product as
   * broker-confirmed — future shipments of that product reuse it); the
   * remaining classified lines are approved. Shipments without line items
   * (seeded demos) skip untouched.
   */
  private async applyResolutionToLines(
    organizationId: string,
    shipmentId: string,
    dto: ResolveReviewDto,
  ) {
    const { data: reviewEvents } = await listShipmentEvents(
      { organizationId, shipmentId, types: ["review_requested"] },
      { occurredAt: "desc" },
      1,
    );
    const payload = reviewEvents[0]?.payload as
      | { lineItemId?: string }
      | undefined;
    const { data: lines } = await listShipmentLineItems({
      organizationId,
      shipmentId,
    });
    if (lines.length === 0) return;

    for (const line of lines) {
      const isReviewedLine = line.id === payload?.lineItemId;

      if (
        isReviewedLine &&
        dto.action === ReviewResolutionAction.Corrected &&
        dto.alternate
      ) {
        await updateShipmentLineItem(line.id, organizationId, {
          htsCode: dto.alternate,
          status: LineItemStatus.Corrected,
        });
        if (line.productId) {
          await updateProduct(line.productId, organizationId, {
            htsCode: dto.alternate,
            confidence: 1,
            classifiedAt: new Date(),
            source: "broker",
          });
        }
        continue;
      }

      if (
        line.status === LineItemStatus.Classified ||
        line.status === LineItemStatus.NeedsReview
      ) {
        await updateShipmentLineItem(line.id, organizationId, {
          status: LineItemStatus.Approved,
        });
        // Approving the review confirms every line the broker saw in the
        // table — their products become broker-verified and reusable.
        if (line.productId) {
          await updateProduct(line.productId, organizationId, {
            source: "broker",
            classifiedAt: new Date(),
          });
        }
      }
    }
  }

  /** The shipment's entry lines with their classifications. */
  async lines(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    const { data } = await listShipmentLineItems({
      organizationId,
      shipmentId: id,
    });
    return {
      lines: data.map((line) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        description: line.description,
        sku: line.sku,
        quantity: line.quantity,
        unit: line.unit,
        totalValueUsd:
          line.totalValueCents === null ? null : line.totalValueCents / 100,
        originCountry: line.originCountry,
        htsCode: line.htsCode,
        confidence: line.confidence,
        status: line.status,
        reusedFromProduct: line.reusedFromProduct,
        productId: line.productId,
      })),
    };
  }

  /** Kick off an asynchronous classification run for a shipment. */
  async classify(organizationId: string, userId: string, id: string) {
    const shipment = await selectShipment(id, organizationId);
    if (!shipment) {
      throw new NotFoundException(`Shipment "${id}" not found`);
    }

    const result = await inngest.send({
      name: SHIPMENT_CLASSIFY_REQUESTED_EVENT,
      data: { organizationId, userId, shipmentId: id },
    });

    return { eventIds: result.ids };
  }
}
