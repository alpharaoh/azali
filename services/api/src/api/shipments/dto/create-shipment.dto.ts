import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ShipmentStage, ShipmentStatus } from "@/db/schemas/shipments";

export const transportModes = ["ocean", "air", "truck", "rail"] as const;

export const createShipmentSchema = z.object({
  clientId: z
    .string()
    .min(1)
    .describe("Id of the client this shipment belongs to."),
  reference: z
    .string()
    .min(1)
    .describe("Internal shipment reference; unique within the organization."),
  entryNumber: z
    .string()
    .min(1)
    .nullish()
    .describe("CBP entry number once the entry is filed."),
  stage: z
    .enum(ShipmentStage)
    .default(ShipmentStage.Intake)
    .describe(
      "Pipeline stage: intake → classification → compliance → entry → filed → released.",
    ),
  status: z
    .enum(ShipmentStatus)
    .default(ShipmentStatus.Autopilot)
    .describe(
      "Operational status: autopilot, needs_review, awaiting_cbp, or released.",
    ),
  originCountry: z
    .string()
    .length(2)
    .describe("Country of export (ISO 3166-1 alpha-2)."),
  originPort: z.string().min(1).nullish().describe("Port of lading overseas."),
  portOfEntry: z.string().min(1).describe("US port of entry."),
  transportMode: z
    .enum(transportModes)
    .describe("How the cargo moves: ocean, air, truck, or rail."),
  conveyance: z
    .string()
    .min(1)
    .nullish()
    .describe("Vessel name or flight/trip number."),
  etaAt: z.iso.datetime().nullish().describe("Estimated arrival time."),
  valueCents: z
    .number()
    .int()
    .min(0)
    .describe("Declared shipment value in US cents."),
  dutyCents: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Estimated or computed duty in US cents."),
  incoterm: z
    .string()
    .min(1)
    .nullish()
    .describe("Incoterm on the commercial invoice (e.g. FOB, CIF)."),
  entryType: z
    .string()
    .min(1)
    .nullish()
    .describe('CBP entry type code (e.g. "01" consumption).'),
});

export class CreateShipmentDto extends createZodDto(createShipmentSchema) {}
