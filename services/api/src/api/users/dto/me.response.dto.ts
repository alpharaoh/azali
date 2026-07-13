import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const meResponseSchema = z.object({
  user: z
    .object({
      id: z.string().describe("User id."),
      name: z.string().describe("Display name."),
      email: z.string().describe("Email address."),
      emailVerified: z.boolean().describe("Whether the email is verified."),
      image: z.string().nullish().describe("Avatar URL, if any."),
      createdAt: z.iso.datetime().describe("When the account was created."),
      updatedAt: z.iso
        .datetime()
        .describe("When the account was last updated."),
    })
    .describe("The signed-in user."),
  organization: z
    .object({
      id: z.string().describe("Organization id."),
      name: z.string().describe("Organization display name."),
      slug: z.string().describe("URL-safe identifier derived from the name."),
      logo: z.string().nullable().describe("Logo URL, if any."),
      createdAt: z.iso
        .datetime()
        .describe("When the organization was created."),
      metadata: z
        .string()
        .nullable()
        .describe("Additional organization metadata, if any."),
      description: z
        .string()
        .nullable()
        .describe("Short description of the brokerage."),
      website: z.string().nullable().describe("Company website URL."),
      contactEmail: z.string().nullable().describe("Contact email."),
      filerCode: z
        .string()
        .nullable()
        .describe("CBP broker filer code (3 alphanumeric characters)."),
    })
    .nullable()
    .describe("The session's active organization; null when none is active."),
  member: z
    .object({
      id: z.string().describe("Membership id."),
      role: z
        .string()
        .describe("Role in the organization: owner, admin, or member."),
      createdAt: z.iso.datetime().describe("When the user joined."),
    })
    .nullable()
    .describe("The user's membership in the active organization."),
});

export class MeResponseDto extends createZodDto(meResponseSchema) {}
