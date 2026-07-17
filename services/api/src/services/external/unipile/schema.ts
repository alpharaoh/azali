import { z } from "zod";

/**
 * Zod schemas for the payloads Unipile pushes to us. Deliberately loose —
 * unknown extra keys or missing optional fields must never fail ingestion,
 * so only the fields the pipeline actually relies on are required.
 */

const attendeeSchema = z.looseObject({
  display_name: z.string().nullish(),
  identifier: z.string(),
  identifier_type: z.string().nullish(),
});

export type UnipileAttendee = z.infer<typeof attendeeSchema>;

/** Attachment entries as they appear on webhook payloads and email reads. */
export const unipileAttachmentSchema = z.looseObject({
  id: z.string(),
  name: z.string().nullish(),
  size: z.number().nullish(),
  mime: z.string().nullish(),
  extension: z.string().nullish(),
});

export type UnipileAttachment = z.infer<typeof unipileAttachmentSchema>;

/** The `new email` webhook body (events: mail_received, mail_sent, mail_moved). */
export const newEmailWebhookSchema = z.looseObject({
  email_id: z.string(),
  account_id: z.string(),
  event: z.string(),
  webhook_name: z.string().nullish(),
  date: z.string(),
  from_attendee: attendeeSchema,
  to_attendees: z.array(attendeeSchema).default([]),
  cc_attendees: z.array(attendeeSchema).default([]),
  reply_to_attendees: z.array(attendeeSchema).default([]),
  provider_id: z.string().nullish(),
  message_id: z.string().nullish(),
  has_attachments: z.boolean().default(false),
  subject: z.string().nullish(),
  body: z.string().nullish(),
  body_plain: z.string().nullish(),
  attachments: z.array(unipileAttachmentSchema).default([]),
  folders: z.array(z.string()).default([]),
  role: z.string().nullish(),
  is_complete: z.boolean().nullish(),
  in_reply_to: z
    .looseObject({
      message_id: z.string().nullish(),
      id: z.string().nullish(),
    })
    .nullish(),
  tracking_id: z.string().nullish(),
  origin: z.string().nullish(),
});

export type NewEmailWebhook = z.infer<typeof newEmailWebhookSchema>;

/**
 * The hosted-auth notify callback. `name` echoes back whatever we passed
 * when creating the link — we pass the single-use connect token that ties
 * the connection to the org/user who requested it.
 */
export const hostedAuthNotifySchema = z.looseObject({
  status: z.string(),
  account_id: z.string(),
  name: z.string(),
});

export type HostedAuthNotify = z.infer<typeof hostedAuthNotifySchema>;
