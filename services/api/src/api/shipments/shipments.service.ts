import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { deleteShipment } from "@/db/queries/delete/deleteShipment";
import { insertShipment } from "@/db/queries/insert/insertShipment";
import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import { aggregateShipmentStats } from "@/db/queries/select/many/aggregateShipmentStats";
import { listShipments } from "@/db/queries/select/many/listShipments";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import { updateShipment } from "@/db/queries/update/updateShipment";
import { ShipmentStage, ShipmentStatus } from "@/db/schemas/shipments";
import type { CreateShipmentDto } from "./dto/create-shipment.dto";
import type { ListShipmentsDto } from "./dto/list-shipments.dto";
import {
  ReviewResolutionAction,
  type ResolveReviewDto,
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
    const shipment = await updateShipment(id, organizationId, toInsertValues(dto));
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

    const nextStage = advanceStage(shipment.stage);

    const updated = await updateShipment(id, organizationId, {
      stage: nextStage,
      status: statusForStage(nextStage),
      reviewDeadlineAt: null,
      reviewType: null,
    });

    return updated ?? shipment;
  }
}
