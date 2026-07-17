import { env } from "@/env";
import { getUnipileClient } from "./client";

/** "MAIL" is Unipile's generic IMAP/SMTP provider. */
export type MailProvider = "GOOGLE" | "OUTLOOK" | "MAIL";

const ALL_MAIL_PROVIDERS: MailProvider[] = ["GOOGLE", "OUTLOOK", "MAIL"];

/** `returnUrl` with a `connected` result flag appended. */
function redirectUrl(returnUrl: string, result: "success" | "error") {
  const url = new URL(returnUrl);
  url.searchParams.set("connected", result);
  return url.toString() as `http${string}`;
}

/**
 * Thin wrapper over the Unipile SDK for the email-ingestion flow: hosted
 * auth links to connect customer inboxes, and email/attachment reads for
 * the inbound webhook pipeline.
 */
export class UnipileService {
  /**
   * A one-time URL where the customer connects a mail provider. `name`
   * carries our opaque connect token — Unipile echoes it back on the
   * notify callback so the new account lands on the right org/user.
   * `returnUrl` (already origin-validated by the caller) is where the
   * hosted page sends the user afterwards.
   */
  static async createHostedAuthLink({
    name,
    expiresOn,
    providers,
    returnUrl,
  }: {
    name: string;
    expiresOn: Date;
    providers?: MailProvider[];
    returnUrl?: string;
  }): Promise<{ url: string }> {
    if (!env.API_BASE_URL) {
      throw new Error(
        "API_BASE_URL is not set — required to receive Unipile hosted-auth callbacks",
      );
    }
    const client = getUnipileClient();
    const response = await client.account.createHostedAuthLink({
      type: "create",
      providers: providers?.length ? providers : ALL_MAIL_PROVIDERS,
      api_url: `https://${env.UNIPILE_DSN}`,
      expiresOn: expiresOn.toISOString() as `${string}Z`,
      notify_url: `${env.API_BASE_URL}/v1/webhooks/unipile/hosted-auth`,
      name,
      ...(returnUrl
        ? {
            success_redirect_url: redirectUrl(returnUrl, "success"),
            failure_redirect_url: redirectUrl(returnUrl, "error"),
          }
        : {}),
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
   * Unipile's `name` is the mailbox address for mail accounts). The account
   * type is normalized to our provider vocabulary: Unipile reports variants
   * like GOOGLE_OAUTH or EXCHANGE that must not leak into rows the UI
   * matches against GOOGLE/OUTLOOK/MAIL. */
  static async getAccount({ accountId }: { accountId: string }) {
    const client = getUnipileClient();
    const account = await client.account.getOne(accountId);
    const provider: MailProvider = account.type.startsWith("GOOGLE")
      ? "GOOGLE"
      : account.type === "OUTLOOK" || account.type === "EXCHANGE"
        ? "OUTLOOK"
        : "MAIL";
    return {
      provider,
      emailAddress: account.name,
    };
  }
}
