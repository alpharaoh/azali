import { Injectable, NotFoundException } from "@nestjs/common";
import { insertShipmentEvent } from "@/db/queries/insert/insertShipmentEvent";
import { listShipmentEvents } from "@/db/queries/select/many/listShipmentEvents";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import { selectShipmentDocument } from "@/db/queries/select/one/selectShipmentDocument";
import { updateShipment } from "@/db/queries/update/updateShipment";
import { ShipmentStatus } from "@/db/schemas/shipments";
import { BlobStorageService } from "@/services/external/s3/service";
import type { CreateShipmentEventDto } from "./dto/create-shipment-event.dto";
import type { ListShipmentEventsDto } from "./dto/list-shipment-events.dto";

type ShipmentEventRow = Awaited<
  ReturnType<typeof listShipmentEvents>
>["data"][number];

/**
 * Document events store only a documentId — viewing links expire, so fresh
 * presigned src/previewUrl are attached to the payload on every read.
 */
async function attachDocumentLinks(
  organizationId: string,
  events: ShipmentEventRow[],
): Promise<ShipmentEventRow[]> {
  const payloadDocumentId = (event: ShipmentEventRow) => {
    const { documentId } = event.payload as { documentId?: unknown };
    return typeof documentId === "string" ? documentId : null;
  };

  const documentIds = [
    ...new Set(events.map(payloadDocumentId).filter((id) => id !== null)),
  ];
  if (documentIds.length === 0) return events;

  const links = new Map<string, { src: string; previewUrl: string | null }>();
  await Promise.all(
    documentIds.map(async (id) => {
      const doc = await selectShipmentDocument(id, organizationId);
      if (!doc) return;
      links.set(doc.id, {
        src: await BlobStorageService.getDownloadUrl({ key: doc.storageKey }),
        previewUrl: doc.previewKey
          ? await BlobStorageService.getDownloadUrl({ key: doc.previewKey })
          : null,
      });
    }),
  );

  return events.map((event) => {
    const documentId = payloadDocumentId(event);
    const link = documentId ? links.get(documentId) : undefined;
    return link ? { ...event, payload: { ...event.payload, ...link } } : event;
  });
}

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

    const { data, count } = await listShipmentEvents(
      { organizationId, types: type, actors: actor },
      { occurredAt: "desc" },
      limit,
      offset,
    );

    return { data: await attachDocumentLinks(organizationId, data), count };
  }

  async findByShipment(
    organizationId: string,
    shipmentId: string,
    query: ListShipmentEventsDto,
  ) {
    const { limit, offset, type, actor } = query;

    const { data, count } = await listShipmentEvents(
      { organizationId, shipmentId, types: type, actors: actor },
      { occurredAt: "desc" },
      limit,
      offset,
    );

    return { data: await attachDocumentLinks(organizationId, data), count };
  }
}
