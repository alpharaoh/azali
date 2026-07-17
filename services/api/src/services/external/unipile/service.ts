import { env } from "@/env";
import { getUnipileClient } from "./client";

/**
 * Thin wrapper over the Unipile SDK for the email-ingestion flow: hosted
 * auth links to connect customer inboxes, and email/attachment reads for
 * the inbound webhook pipeline.
 */
export class UnipileService {
  /**
   * A one-time URL where the customer connects any mail provider. `name`
   * carries our opaque connect token — Unipile echoes it back on the
   * notify callback so the new account lands on the right org/user.
   */
  static async createHostedAuthLink({
    name,
    expiresOn,
  }: {
    name: string;
    expiresOn: Date;
  }): Promise<{ url: string }> {
    if (!env.API_BASE_URL) {
      throw new Error(
        "API_BASE_URL is not set — required to receive Unipile hosted-auth callbacks",
      );
    }
    const client = getUnipileClient();
    const response = await client.account.createHostedAuthLink({
      type: "create",
      // "MAIL" is Unipile's generic IMAP/SMTP provider.
      providers: ["GOOGLE", "OUTLOOK", "MAIL"],
      api_url: `https://${env.UNIPILE_DSN}`,
      expiresOn: expiresOn.toISOString() as `${string}Z`,
      notify_url: `${env.API_BASE_URL}/v1/webhooks/unipile/hosted-auth`,
      name,
    });
    return { url: response.url };
  }

  /** Full email read — fallback when a webhook says `has_attachments` but
   * carries an empty attachments array. */
  static async getEmail({ emailId }: { emailId: string }) {
    const client = getUnipileClient();
    return client.email.getOne(emailId);
  }

  static async getEmailAttachment({
    emailId,
    attachmentId,
  }: {
    emailId: string;
    attachmentId: string;
  }): Promise<Uint8Array> {
    const client = getUnipileClient();
    const blob = await client.email.getEmailAttachment({
      email_id: emailId,
      attachment_id: attachmentId,
    });
    return new Uint8Array(await blob.arrayBuffer());
  }

  /** Provider + mailbox identity for a connected account (best effort —
   * Unipile's `name` is the mailbox address for mail accounts). */
  static async getAccount({ accountId }: { accountId: string }) {
    const client = getUnipileClient();
    const account = await client.account.getOne(accountId);
    return {
      provider: account.type,
      emailAddress: account.name,
    };
  }
}
