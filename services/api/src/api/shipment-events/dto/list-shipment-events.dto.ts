import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { eventActors } from "./create-shipment-event.dto";

const csv = <S extends z.ZodType>(schema: S) =>
  z.preprocess(
    (value) =>
      typeof value === "string" ? value.split(",").filter(Boolean) : value,
    z.array(schema),
  );

export const listShipmentEventsSchema = z.object({
  shipmentId: z.string().optional(),
  type: csv(z.string().min(1)).optional(),
  actor: csv(z.enum(eventActors)).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export class ListShipmentEventsDto extends createZodDto(
  listShipmentEventsSchema,
) {}
