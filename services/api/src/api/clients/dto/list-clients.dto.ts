import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ClientAutonomy, ClientStatus } from "@/db/schemas/clients";

export const listClientsSchema = z.object({
  status: z.enum(ClientStatus).optional(),
  autonomy: z.enum(ClientAutonomy).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export class ListClientsDto extends createZodDto(listClientsSchema) {}
