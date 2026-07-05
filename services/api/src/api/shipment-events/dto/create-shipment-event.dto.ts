import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const eventActors = ["ai", "user", "system", "cbp"] as const;

// The owning shipment comes from the route path (/shipments/:shipmentId/events).
export const createShipmentEventSchema = z.object({
  /** Open string, e.g. invoice_received, hts_lookup, review_requested. */
  type: z.string().min(1),
  actor: z.enum(eventActors).default("system"),
  title: z.string().min(1),
  occurredAt: z.iso.datetime().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export class CreateShipmentEventDto extends createZodDto(
  createShipmentEventSchema,
) {}
