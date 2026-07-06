import { createZodDto } from "nestjs-zod";
import { z } from "zod";

// The slug is derived server-side from the name — never accepted as input.
export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .describe("Organization display name; the slug is re-derived from it."),
  description: z
    .string()
    .max(240)
    .nullish()
    .describe("Short description of the brokerage (max 240 characters)."),
  website: z.string().max(200).nullish().describe("Company website URL."),
  contactEmail: z
    .email()
    .nullish()
    .describe("Contact email shown to clients and used for CBP correspondence."),
  filerCode: z
    .string()
    .regex(/^[A-Za-z0-9]{3}$/, "Filer code is 3 letters/digits")
    .nullish()
    .describe(
      "CBP broker filer code — exactly 3 alphanumeric characters; stored uppercase.",
    ),
});

export class UpdateOrganizationDto extends createZodDto(
  updateOrganizationSchema,
) {}
