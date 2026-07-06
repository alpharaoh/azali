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
  type: csv(z.string().min(1))
    .optional()
    .describe("Filter by event type; comma-separated for multiple values."),
  actor: csv(z.enum(eventActors))
    .optional()
    .describe("Filter by actor; comma-separated for multiple values."),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("Page size (1–200)."),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Rows to skip before the page starts."),
});

export class ListShipmentEventsDto extends createZodDto(
  listShipmentEventsSchema,
) {}
