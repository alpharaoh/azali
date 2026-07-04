import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ClientAutonomy, ClientStatus } from "@/db/schemas/clients";

export const clientSchema = z.object({
  id: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
  deletedAt: z.iso.datetime().nullable(),
  organizationId: z.string(),
  userId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  iorNumber: z.string(),
  bondNumber: z.string(),
  primaryOrigin: z.string(),
  industry: z.string(),
  autonomy: z.enum(ClientAutonomy),
  status: z.enum(ClientStatus),
  portsOfEntry: z.array(z.string()),
});

export class ClientResponseDto extends createZodDto(clientSchema) {}

export class ListClientsResponseDto extends createZodDto(
  z.object({
    data: z.array(clientSchema),
    count: z.number().int(),
  }),
) {}
