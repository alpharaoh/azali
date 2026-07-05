import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ShipmentStage, ShipmentStatus } from "@/db/schemas/shipments";

const csv = <S extends z.ZodType>(schema: S) =>
  z.preprocess(
    (value) =>
      typeof value === "string" ? value.split(",").filter(Boolean) : value,
    z.array(schema),
  );

export const sortableShipmentColumns = [
  "reference",
  "stage",
  "status",
  "etaAt",
  "reviewDeadlineAt",
  "valueCents",
  "createdAt",
] as const;

export const listShipmentsSchema = z.object({
  search: z.string().optional(),
  stage: csv(z.enum(ShipmentStage)).optional(),
  status: csv(z.enum(ShipmentStatus)).optional(),
  clientId: csv(z.string().min(1)).optional(),
  reviewType: csv(z.string().min(1)).optional(),
  /** Inclusive shipment value bounds, in cents. */
  valueMin: z.coerce.number().int().min(0).optional(),
  valueMax: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(sortableShipmentColumns).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export class ListShipmentsDto extends createZodDto(listShipmentsSchema) {}
