import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const eventActors = ["ai", "user", "system", "cbp"] as const;

// The owning shipment comes from the route path (/shipments/:shipmentId/events).
export const createShipmentEventSchema = z.object({
  type: z
    .string()
    .min(1)
    .describe(
      "Event type, e.g. document_received, agent_trace, review_requested, broker_note.",
    ),
  actor: z
    .enum(eventActors)
    .default("system")
    .describe("Who produced the event: ai, user, system, or cbp."),
  title: z.string().min(1).describe("Human-readable one-line summary."),
  occurredAt: z.iso
    .datetime()
    .optional()
    .describe("When the event happened; defaults to now."),
  payload: z
    .record(z.string(), z.unknown())
    .default({})
    .describe("Type-specific structured data."),
});

export class CreateShipmentEventDto extends createZodDto(
  createShipmentEventSchema,
) {}
