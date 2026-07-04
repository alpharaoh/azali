import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const meResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullish(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
  organization: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      logo: z.string().nullable(),
      createdAt: z.iso.datetime(),
      metadata: z.string().nullable(),
    })
    .nullable(),
  member: z
    .object({
      id: z.string(),
      role: z.string(),
      createdAt: z.iso.datetime(),
    })
    .nullable(),
});

export class MeResponseDto extends createZodDto(meResponseSchema) {}
