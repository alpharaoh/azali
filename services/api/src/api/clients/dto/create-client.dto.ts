import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ClientAutonomy, ClientStatus } from "@/db/schemas/clients";

export const createClientSchema = z.object({
  name: z.string().min(1).describe("Client display name."),
  image: z.string().min(1).nullish().describe("Logo URL."),
  iorNumber: z
    .string()
    .min(1)
    .describe("Importer of Record number used on customs entries."),
  bondNumber: z.string().min(1).describe("Continuous customs bond number."),
  primaryOrigin: z
    .string()
    .min(1)
    .describe("Primary country of origin (ISO 3166-1 alpha-2)."),
  industry: z
    .string()
    .min(1)
    .describe("Industry, aligned with CBP Centers of Excellence & Expertise."),
  autonomy: z
    .enum(ClientAutonomy)
    .default(ClientAutonomy.Supervised)
    .describe(
      "Automation level: supervised (broker reviews) or autopilot (confident work flows through).",
    ),
  status: z
    .enum(ClientStatus)
    .default(ClientStatus.Active)
    .describe("Whether automation is active or paused for this client."),
  portsOfEntry: z
    .array(z.string().min(1))
    .default([])
    .describe("Ports of entry this client typically clears through."),
});

export class CreateClientDto extends createZodDto(createClientSchema) {}
