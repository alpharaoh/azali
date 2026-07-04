import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ClientAutonomy, ClientStatus } from "@/db/schemas/clients";

export const createClientSchema = z.object({
  name: z.string().min(1),
  image: z.string().min(1).nullish(),
  iorNumber: z.string().min(1),
  bondNumber: z.string().min(1),
  primaryOrigin: z.string().min(1),
  industry: z.string().min(1),
  autonomy: z.enum(ClientAutonomy).default(ClientAutonomy.Supervised),
  status: z.enum(ClientStatus).default(ClientStatus.Active),
  portsOfEntry: z.array(z.string().min(1)).default([]),
});

export class CreateClientDto extends createZodDto(createClientSchema) {}
