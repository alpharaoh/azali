import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const shipmentEventSchema = z.object({
  id: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
  deletedAt: z.iso.datetime().nullable(),
  organizationId: z.string(),
  userId: z.string(),
  shipmentId: z.string(),
  type: z.string(),
  actor: z.string(),
  title: z.string(),
  occurredAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()),
});

export class ShipmentEventResponseDto extends createZodDto(
  shipmentEventSchema,
) {}

export class ListShipmentEventsResponseDto extends createZodDto(
  z.object({
    data: z.array(shipmentEventSchema),
    count: z.number().int(),
  }),
) {}
