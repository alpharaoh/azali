import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ShipmentStage, ShipmentStatus } from "@/db/schemas/shipments";

export const transportModes = ["ocean", "air", "truck", "rail"] as const;

export const createShipmentSchema = z.object({
  clientId: z.string().min(1),
  reference: z.string().min(1),
  entryNumber: z.string().min(1).nullish(),
  stage: z.enum(ShipmentStage).default(ShipmentStage.Intake),
  status: z.enum(ShipmentStatus).default(ShipmentStatus.Autopilot),
  originCountry: z.string().length(2),
  originPort: z.string().min(1).nullish(),
  portOfEntry: z.string().min(1),
  transportMode: z.enum(transportModes),
  conveyance: z.string().min(1).nullish(),
  etaAt: z.iso.datetime().nullish(),
  valueCents: z.number().int().min(0),
  dutyCents: z.number().int().min(0).default(0),
  incoterm: z.string().min(1).nullish(),
  entryType: z.string().min(1).nullish(),
});

export class CreateShipmentDto extends createZodDto(createShipmentSchema) {}
