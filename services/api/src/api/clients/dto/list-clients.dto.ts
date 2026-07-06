import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ClientAutonomy, ClientStatus } from "@/db/schemas/clients";

const csv = <S extends z.ZodType>(schema: S) =>
  z.preprocess(
    (value) =>
      typeof value === "string" ? value.split(",").filter(Boolean) : value,
    z.array(schema),
  );

export const sortableClientColumns = [
  "name",
  "iorNumber",
  "bondNumber",
  "primaryOrigin",
  "industry",
  "autonomy",
  "status",
  "createdAt",
] as const;

export const listClientsSchema = z.object({
  search: z
    .string()
    .optional()
    .describe("Free-text search on the client name (case-insensitive)."),
  status: csv(z.enum(ClientStatus))
    .optional()
    .describe("Filter by status; comma-separated for multiple values."),
  autonomy: csv(z.enum(ClientAutonomy))
    .optional()
    .describe("Filter by autonomy; comma-separated for multiple values."),
  sortBy: z
    .enum(sortableClientColumns)
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

export class ListClientsDto extends createZodDto(listClientsSchema) {}
