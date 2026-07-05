import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ShipmentStage, ShipmentStatus } from "@/db/schemas/shipments";

export const shipmentSchema = z.object({
  id: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
  deletedAt: z.iso.datetime().nullable(),
  organizationId: z.string(),
  userId: z.string(),
  clientId: z.string(),
  reference: z.string(),
  entryNumber: z.string().nullable(),
  stage: z.enum(ShipmentStage),
  status: z.enum(ShipmentStatus),
  reviewDeadlineAt: z.iso.datetime().nullable(),
  reviewType: z.string().nullable(),
  originCountry: z.string(),
  originPort: z.string().nullable(),
  portOfEntry: z.string(),
  transportMode: z.string(),
  conveyance: z.string().nullable(),
  etaAt: z.iso.datetime().nullable(),
  valueCents: z.number().int(),
  dutyCents: z.number().int(),
  incoterm: z.string().nullable(),
  entryType: z.string().nullable(),
});

export class ShipmentResponseDto extends createZodDto(shipmentSchema) {}

export class ListShipmentsResponseDto extends createZodDto(
  z.object({
    data: z.array(shipmentSchema),
    count: z.number().int(),
  }),
) {}

export class ShipmentStatsResponseDto extends createZodDto(
  z.object({
    total: z.number().int(),
    byStatus: z.object({
      autopilot: z.number().int(),
      needs_review: z.number().int(),
      awaiting_cbp: z.number().int(),
      released: z.number().int(),
    }),
    byReviewType: z.record(z.string(), z.number().int()),
  }),
) {}
