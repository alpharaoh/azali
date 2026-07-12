import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const shipmentEventSchema = z.object({
  id: z.string().describe("Event id."),
  createdAt: z.iso.datetime().describe("When the event was recorded."),
  updatedAt: z.iso
    .datetime()
    .nullable()
    .describe("Always null — events cannot be modified."),
  deletedAt: z.iso
    .datetime()
    .nullable()
    .describe("Always null — events cannot be removed."),
  organizationId: z.string().describe("Owning organization id."),
  userId: z.string().describe("Id of the user who recorded the event."),
  shipmentId: z.string().describe("Shipment this event belongs to."),
  type: z
    .string()
    .describe(
      "Open event type, e.g. document_received, agent_trace, review_requested, broker_note.",
    ),
  actor: z.string().describe("Who produced the event: ai, user, system, or cbp."),
  title: z.string().describe("Human-readable one-line summary."),
  occurredAt: z.iso.datetime().describe("When the event happened."),
  payload: z
    .record(z.string(), z.unknown())
    .describe(
      "Type-specific structured data. Document events also carry src and previewUrl — short-lived links to the file and its preview image. Links expire after 5 minutes; request the list again for fresh ones.",
    ),
});

export class ShipmentEventResponseDto extends createZodDto(
  shipmentEventSchema,
) {}

export class ListShipmentEventsResponseDto extends createZodDto(
  z.object({
    data: z.array(shipmentEventSchema).describe("The page of events."),
    count: z
      .number()
      .int()
      .describe("Total events matching the filters, ignoring pagination."),
  }),
) {}
