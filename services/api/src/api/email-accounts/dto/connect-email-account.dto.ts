import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const EMAIL_PROVIDERS = ["GOOGLE", "OUTLOOK", "MAIL"] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

export const connectEmailAccountSchema = z.object({
  provider: z
    .enum(EMAIL_PROVIDERS)
    .optional()
    .describe(
      "Take the user straight into this provider's connection flow (MAIL = generic IMAP). Omit to let them pick on the hosted page.",
    ),
  returnUrl: z
    .url()
    .optional()
    .describe(
      "Where to send the user after they finish connecting. Must be on one of the app's trusted origins; a `connected=success|error` query param is appended.",
    ),
});

export class ConnectEmailAccountDto extends createZodDto(
  connectEmailAccountSchema,
) {}
