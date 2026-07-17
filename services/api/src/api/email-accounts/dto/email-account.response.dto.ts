import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const connectEmailAccountResponseSchema = z.object({
  url: z
    .string()
    .describe(
      "Hosted page where the user securely connects their inbox. Single use.",
    ),
  expiresAt: z.string().describe("ISO instant the connect link stops working."),
});

export class ConnectEmailAccountResponseDto extends createZodDto(
  connectEmailAccountResponseSchema,
) {}

export const listEmailAccountsResponseSchema = z.object({
  accounts: z.array(
    z.object({
      id: z.string(),
      provider: z.string().nullable().describe("E.g. GOOGLE, OUTLOOK, MAIL."),
      emailAddress: z.string().nullable(),
      status: z.string().describe("pending | connected | disconnected | error"),
      connectedByUserId: z.string(),
      lastWebhookAt: z
        .string()
        .nullable()
        .describe("Last time mail was delivered for this inbox."),
      createdAt: z.string(),
    }),
  ),
});

export class ListEmailAccountsResponseDto extends createZodDto(
  listEmailAccountsResponseSchema,
) {}
