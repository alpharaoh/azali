import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ShipmentStage, ShipmentStatus } from "@/db/schemas/shipments";

export const shipmentSchema = z.object({
  id: z.string().describe("Shipment id."),
  createdAt: z.iso.datetime().describe("When the shipment was created."),
  updatedAt: z.iso
    .datetime()
    .nullable()
    .describe("When the shipment was last updated; null if never."),
  deletedAt: z.iso
    .datetime()
    .nullable()
    .describe("When the shipment was deleted; null for active shipments."),
  organizationId: z.string().describe("Owning organization id."),
  userId: z.string().describe("Id of the user who created the shipment."),
  clientId: z.string().describe("Id of the client this shipment belongs to."),
  client: z
    .object({
      id: z.string().describe("Client id."),
      name: z.string().describe("Client display name."),
      image: z.string().nullable().describe("Logo URL, if any."),
    })
    .nullable()
    .describe(
      "The owning client, embedded so lists can be rendered without a separate clients request.",
    ),
  reference: z
    .string()
    .describe("Internal shipment reference; unique within the organization."),
  entryNumber: z
    .string()
    .nullable()
    .describe("CBP entry number once the entry is filed."),
  stage: z
    .enum(ShipmentStage)
    .describe(
      "Pipeline stage: intake → classification → compliance → entry → filed → released.",
    ),
  status: z
    .enum(ShipmentStatus)
    .describe(
      "Operational status: autopilot, needs_review, awaiting_cbp, or released.",
    ),
  reviewDeadlineAt: z.iso
    .datetime()
    .nullable()
    .describe("Deadline of the pending review; null when nothing is pending."),
  reviewType: z
    .string()
    .nullable()
    .describe(
      "Kind of pending review (e.g. classification, signoff); null when nothing is pending.",
    ),
  summary: z
    .record(z.string(), z.unknown())
    .describe(
      "Fast-changing snapshot for display: current HTS + confidence, duty rate, flags, next action.",
    ),
  originCountry: z.string().describe("Country of export (ISO 3166-1 alpha-2)."),
  originPort: z.string().nullable().describe("Port of lading overseas."),
  portOfEntry: z.string().describe("US port of entry."),
  transportMode: z
    .string()
    .describe("How the cargo moves: ocean, air, truck, or rail."),
  conveyance: z
    .string()
    .nullable()
    .describe("Vessel name or flight/trip number."),
  etaAt: z.iso.datetime().nullable().describe("Estimated arrival time."),
  valueCents: z.number().int().describe("Declared shipment value in US cents."),
  dutyCents: z
    .number()
    .int()
    .describe("Estimated or computed duty in US cents."),
  incoterm: z
    .string()
    .nullable()
    .describe("Incoterm on the commercial invoice (e.g. FOB, CIF)."),
  entryType: z
    .string()
    .nullable()
    .describe('CBP entry type code (e.g. "01" consumption).'),
});

export class ShipmentResponseDto extends createZodDto(shipmentSchema) {}

export class ListShipmentsResponseDto extends createZodDto(
  z.object({
    data: z.array(shipmentSchema).describe("The page of shipments."),
    count: z
      .number()
      .int()
      .describe("Total shipments matching the filters, ignoring pagination."),
  }),
) {}

export class ShipmentStatsResponseDto extends createZodDto(
  z.object({
    total: z.number().int().describe("Total live shipments."),
    byStatus: z
      .object({
        autopilot: z.number().int(),
        needs_review: z.number().int(),
        awaiting_cbp: z.number().int(),
        released: z.number().int(),
      })
      .describe("Shipment counts per operational status."),
    byReviewType: z
      .record(z.string(), z.number().int())
      .describe("Pending-review counts keyed by review type."),
  }),
) {}

export class ClassifyResponseDto extends createZodDto(
  z.object({
    eventIds: z
      .array(z.string())
      .describe("Ids of the classification runs started for this shipment."),
  }),
) {}

export class ListShipmentLinesResponseDto extends createZodDto(
  z.object({
    lines: z
      .array(
        z.object({
          id: z.string().describe("Line item id."),
          lineNumber: z.number().describe("Position on the entry."),
          description: z.string().describe("Product description."),
          sku: z.string().nullable().describe("Part/model/SKU, when printed."),
          quantity: z.number().nullable(),
          unit: z.string().nullable().describe("Unit of measure, e.g. PCE."),
          totalValueUsd: z.number().nullable().describe("Line value in USD."),
          originCountry: z.string().nullable(),
          htsCode: z
            .string()
            .nullable()
            .describe("The line's HTS classification."),
          confidence: z.number().nullable(),
          status: z
            .string()
            .describe(
              "pending, classified, needs_review, approved, or corrected.",
            ),
          reusedFromProduct: z
            .boolean()
            .describe("True when the code came from the product library."),
          productId: z.string().nullable().describe("The linked product."),
        }),
      )
      .describe("The shipment's entry lines, in line order."),
  }),
) {}
