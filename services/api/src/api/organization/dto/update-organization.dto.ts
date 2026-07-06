import { createZodDto } from "nestjs-zod";
import { z } from "zod";

// The slug is derived server-side from the name — never accepted as input.
export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(240).nullish(),
  website: z.string().max(200).nullish(),
  contactEmail: z.email().nullish(),
  /** CBP broker filer code — exactly 3 alphanumeric characters. */
  filerCode: z
    .string()
    .regex(/^[A-Za-z0-9]{3}$/, "Filer code is 3 letters/digits")
    .nullish(),
});

export class UpdateOrganizationDto extends createZodDto(
  updateOrganizationSchema,
) {}
