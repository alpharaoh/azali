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
  search: z.string().optional(),
  status: csv(z.enum(ClientStatus)).optional(),
  autonomy: csv(z.enum(ClientAutonomy)).optional(),
  sortBy: z.enum(sortableClientColumns).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export class ListClientsDto extends createZodDto(listClientsSchema) {}
