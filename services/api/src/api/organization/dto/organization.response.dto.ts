import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const organizationProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  createdAt: z.iso.datetime(),
  description: z.string().nullable(),
  website: z.string().nullable(),
  contactEmail: z.string().nullable(),
  filerCode: z.string().nullable(),
});

export class OrganizationResponseDto extends createZodDto(
  organizationProfileSchema,
) {}
