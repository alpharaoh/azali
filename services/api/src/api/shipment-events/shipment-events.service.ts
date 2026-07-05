import { Injectable, NotFoundException } from "@nestjs/common";
import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import { listShipmentEvents } from "@/db/queries/select/many/listShipmentEvents";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import { updateShipment } from "@/db/queries/update/updateShipment";
import { ShipmentStatus } from "@/db/schemas/shipments";
import type { CreateShipmentEventDto } from "./dto/create-shipment-event.dto";
import type { ListShipmentEventsDto } from "./dto/list-shipment-events.dto";

@Injectable()
export class ShipmentEventsService {
  async create(
    organizationId: string,
    userId: string,
    shipmentId: string,
    dto: CreateShipmentEventDto,
  ) {
    const shipment = await selectShipment(shipmentId, organizationId);
    if (!shipment) {
      throw new NotFoundException(`Shipment "${shipmentId}" not found`);
    }

    const event = await insertShipmentEvent({
      organizationId,
      userId,
      shipmentId,
      type: dto.type,
      actor: dto.actor,
      title: dto.title,
      ...(dto.occurredAt && { occurredAt: new Date(dto.occurredAt) }),
      payload: dto.payload,
    });

    // Keep the denormalized review columns on the shipment consistent — the
    // one place that flips a shipment into the review queue.
    if (dto.type === "review_requested") {
      const deadlineAt =
        typeof dto.payload.deadlineAt === "string"
          ? new Date(dto.payload.deadlineAt)
          : null;
      const reviewType =
        typeof dto.payload.reviewType === "string"
          ? dto.payload.reviewType
          : null;

      await updateShipment(shipment.id, organizationId, {
        status: ShipmentStatus.NeedsReview,
        reviewDeadlineAt: deadlineAt,
        reviewType,
      });
    }

    return event;
  }

  async findAll(organizationId: string, query: ListShipmentEventsDto) {
    const { limit, offset, type, actor } = query;

    return listShipmentEvents(
      { organizationId, types: type, actors: actor },
      { occurredAt: "desc" },
      limit,
      offset,
    );
  }

  async findByShipment(
    organizationId: string,
    shipmentId: string,
    query: ListShipmentEventsDto,
  ) {
    const { limit, offset, type, actor } = query;

    return listShipmentEvents(
      { organizationId, shipmentId, types: type, actors: actor },
      { occurredAt: "desc" },
      limit,
      offset,
    );
  }
}
