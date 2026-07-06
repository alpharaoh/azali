import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ClientAutonomy, ClientStatus } from "@/db/schemas/clients";

export const clientSchema = z.object({
  id: z.string().describe("Client id."),
  createdAt: z.iso.datetime().describe("When the client was created."),
  updatedAt: z.iso
    .datetime()
    .nullable()
    .describe("When the client was last updated; null if never."),
  deletedAt: z.iso
    .datetime()
    .nullable()
    .describe("When the client was deleted; null for active clients."),
  organizationId: z.string().describe("Owning organization id."),
  userId: z.string().describe("Id of the user who created the client."),
  name: z.string().describe("Client display name."),
  image: z.string().nullable().describe("Logo URL, if any."),
  iorNumber: z
    .string()
    .describe("Importer of Record number used on customs entries."),
  bondNumber: z.string().describe("Continuous customs bond number."),
  primaryOrigin: z
    .string()
    .describe("Primary country of origin (ISO 3166-1 alpha-2)."),
  industry: z
    .string()
    .describe("Industry, aligned with CBP Centers of Excellence & Expertise."),
  autonomy: z
    .enum(ClientAutonomy)
    .describe(
      "Automation level: supervised (broker reviews) or autopilot (confident work flows through).",
    ),
  status: z
    .enum(ClientStatus)
    .describe("Whether automation is active or paused for this client."),
  portsOfEntry: z
    .array(z.string())
    .describe("Ports of entry this client typically clears through."),
});

export class ClientResponseDto extends createZodDto(clientSchema) {}

export class ListClientsResponseDto extends createZodDto(
  z.object({
    data: z.array(clientSchema).describe("The page of clients."),
    count: z
      .number()
      .int()
      .describe("Total clients matching the filters, ignoring pagination."),
  }),
) {}
