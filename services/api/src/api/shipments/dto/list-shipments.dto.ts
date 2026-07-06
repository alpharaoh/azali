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
  search: z
    .string()
    .optional()
    .describe(
      "Free-text search across reference, entry number, and client name.",
    ),
  stage: csv(z.enum(ShipmentStage))
    .optional()
    .describe("Filter by pipeline stage; comma-separated for multiple values."),
  status: csv(z.enum(ShipmentStatus))
    .optional()
    .describe("Filter by status; comma-separated for multiple values."),
  clientId: csv(z.string().min(1))
    .optional()
    .describe("Filter by client id; comma-separated for multiple values."),
  reviewType: csv(z.string().min(1))
    .optional()
    .describe(
      "Filter by pending review type (e.g. classification, signoff); comma-separated.",
    ),
  valueMin: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Inclusive lower bound on shipment value, in US cents."),
  valueMax: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Inclusive upper bound on shipment value, in US cents."),
  sortBy: z
    .enum(sortableShipmentColumns)
    .default("createdAt")
    .describe("Column to sort by."),
  sortDir: z.enum(["asc", "desc"]).default("desc").describe("Sort direction."),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe("Page size (1–100)."),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Rows to skip before the page starts."),
});

export class ListShipmentsDto extends createZodDto(listShipmentsSchema) {}
