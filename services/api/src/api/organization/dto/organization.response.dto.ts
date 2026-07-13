import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const organizationProfileSchema = z.object({
  id: z.string().describe("Organization id."),
  name: z.string().describe("Organization display name."),
  slug: z
    .string()
    .describe("URL-safe identifier derived from the name; not user-editable."),
  logo: z.string().nullable().describe("Logo URL, if any."),
  createdAt: z.iso.datetime().describe("When the organization was created."),
  description: z
    .string()
    .nullable()
    .describe("Short description of the brokerage."),
  website: z.string().nullable().describe("Company website URL."),
  contactEmail: z
    .string()
    .nullable()
    .describe(
      "Contact email shown to clients and used for CBP correspondence.",
    ),
  filerCode: z
    .string()
    .nullable()
    .describe("CBP broker filer code (3 alphanumeric characters, uppercase)."),
});

export class OrganizationResponseDto extends createZodDto(
  organizationProfileSchema,
) {}
