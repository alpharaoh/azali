import { timingSafeEqual } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { listEmailAccounts } from "@/db/queries/select/many/listEmailAccounts";
import { updateEmailAccount } from "@/db/queries/update/updateEmailAccount";
import { EmailAccountStatus } from "@/db/schema";
import { env } from "@/env";
import { inngest } from "@/inngest/client";
import { INBOUND_EMAIL_RECEIVED_EVENT } from "@/inngest/functions/processInboundEmail";
import {
  hostedAuthNotifySchema,
  newEmailWebhookSchema,
} from "@/services/external/unipile/schema";
import { UnipileService } from "@/services/external/unipile/service";

/**
 * Receives Unipile's callbacks. Both handlers parse manually (never the
 * global validation pipe): a payload shape drift must be logged and
 * acknowledged with 200, not rejected with 400 — Unipile would retry a
 * rejection forever.
 */
@Injectable()
export class UnipileWebhooksService {
  private readonly logger = new Logger(UnipileWebhooksService.name);

  /** Constant-time comparison of the shared webhook secret. */
  verifyWebhookSecret(header: string | undefined): boolean {
    const secret = env.UNIPILE_WEBHOOK_SECRET;
    if (!secret || !header) return false;
    const expected = Buffer.from(secret);
    const received = Buffer.from(header);
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }

  /**
   * Hosted-auth notify: Unipile echoes back the single-use connect token
   * as `name`. Authenticity comes from the token — the org/user binding
   * was fixed server-side when the link was created, so a forged call
   * cannot attach an account to someone else's organization.
   */
  async handleHostedAuthNotify(body: unknown) {
    const parsed = hostedAuthNotifySchema.safeParse(body);
    if (!parsed.success) {
      this.logger.warn(
        { issues: parsed.error.issues },
        "unparseable hosted-auth notify payload — ignoring",
      );
      return { ignored: true };
    }
    const notify = parsed.data;

    if (notify.status === "RECONNECTED") {
      const {
        data: [account],
      } = await listEmailAccounts({ unipileAccountId: notify.account_id });
      if (!account) return { ignored: true };
      await updateEmailAccount(account.id, {
        status: EmailAccountStatus.Connected,
      });
      this.logger.log(`email account ${account.id} reconnected`);
      return { ok: true };
    }

    if (notify.status !== "CREATION_SUCCESS") {
      this.logger.warn(
        `hosted-auth notify with status ${notify.status} — ignoring`,
      );
      return { ignored: true };
    }

    const {
      data: [account],
    } = await listEmailAccounts({
      connectToken: notify.name,
      status: EmailAccountStatus.Pending,
    });
    const expired =
      !account?.connectTokenExpiresAt ||
      account.connectTokenExpiresAt <= new Date();
    if (!account || expired) {
      // Unknown/expired/reused token. Same response as success — status
      // codes must not reveal token validity.
      this.logger.warn("hosted-auth notify with unknown connect token");
      return { ignored: true };
    }

    await updateEmailAccount(account.id, {
      unipileAccountId: notify.account_id,
      status: EmailAccountStatus.Connected,
      connectToken: null,
      connectTokenExpiresAt: null,
    });

    // Best-effort enrichment — the mapping is already durable.
    try {
      const details = await UnipileService.getAccount({
        accountId: notify.account_id,
      });
      await updateEmailAccount(account.id, details);
    } catch (error) {
      this.logger.warn(
        { err: error },
        "could not enrich connected email account",
      );
    }

    this.logger.log(
      `email account ${account.id} connected to unipile ${notify.account_id}`,
    );
    return { ok: true };
  }

  /**
   * New-email webhook → Inngest. Anything that isn't a fresh inbox
   * delivery with attachments is acknowledged and dropped here so the
   * pipeline only ever sees candidate shipment emails.
   */
  async handleEmailWebhook(body: unknown) {
    const parsed = newEmailWebhookSchema.safeParse(body);
    if (!parsed.success) {
      this.logger.warn(
        {
          issues: parsed.error.issues.slice(0, 3),
          bodyType: typeof body,
          bodyKeys:
            body && typeof body === "object"
              ? Object.keys(body).slice(0, 8)
              : null,
        },
        "unparseable email webhook payload — ignoring",
      );
      return { ignored: true };
    }
    const email = parsed.data;

    if (email.event !== "mail_received") return { ignored: true };
    if (email.role && email.role !== "inbox") return { ignored: true };
    if (!email.has_attachments && email.attachments.length === 0) {
      return { ignored: true };
    }

    const {
      data: [account],
    } = await listEmailAccounts({ unipileAccountId: email.account_id });
    if (!account) {
      this.logger.warn(
        `email webhook for unknown account ${email.account_id} — ignoring`,
      );
      return { ignored: true };
    }

    // Loop guard: mail the connected inbox sent to itself.
    if (
      account.emailAddress &&
      email.from_attendee.identifier.toLowerCase() ===
        account.emailAddress.toLowerCase()
    ) {
      return { ignored: true };
    }

    await updateEmailAccount(account.id, { lastWebhookAt: new Date() });

    await inngest.send({
      // Deterministic id: Inngest drops redelivered duplicates upfront.
      id: `unipile-email-${email.account_id}-${email.email_id}`,
      name: INBOUND_EMAIL_RECEIVED_EVENT,
      data: {
        organizationId: account.organizationId,
        userId: account.userId,
        emailAccountId: account.id,
        email,
      },
    });

    return { ok: true };
  }
}
