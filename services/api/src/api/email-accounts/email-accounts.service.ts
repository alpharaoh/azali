import { randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { insertEmailAccount } from "@/db/queries/insert/insertEmailAccount";
import { listEmailAccounts } from "@/db/queries/select/many/listEmailAccounts";
import { updateEmailAccount } from "@/db/queries/update/updateEmailAccount";
import { EmailAccountStatus } from "@/db/schema";
import { UnipileService } from "@/services/external/unipile/service";

/** How long a hosted-auth connect link stays valid. */
const CONNECT_LINK_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class EmailAccountsService {
  /**
   * Start connecting an inbox: create a pending account row bound to this
   * org/user with a single-use token, and hand back the Unipile hosted-auth
   * URL that carries the token as its `name`. The notify callback matches
   * on the token — a connection can only ever land where it was requested.
   */
  async connect(organizationId: string, userId: string) {
    const connectToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + CONNECT_LINK_TTL_MS);

    await insertEmailAccount({
      organizationId,
      userId,
      status: EmailAccountStatus.Pending,
      connectToken,
      connectTokenExpiresAt: expiresAt,
    });

    const { url } = await UnipileService.createHostedAuthLink({
      name: connectToken,
      expiresOn: expiresAt,
    });

    return { url, expiresAt: expiresAt.toISOString() };
  }

  async list(organizationId: string) {
    const { data: accounts } = await listEmailAccounts({ organizationId });
    return {
      accounts: accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        emailAddress: account.emailAddress,
        status: account.status,
        connectedByUserId: account.userId,
        lastWebhookAt: account.lastWebhookAt?.toISOString() ?? null,
        createdAt: account.createdAt.toISOString(),
      })),
    };
  }

  /** Soft-delete: mail deliveries for the account are ignored from now on. */
  async disconnect(organizationId: string, id: string) {
    const {
      data: [account],
    } = await listEmailAccounts({ organizationId, ids: [id] });
    if (!account) {
      throw new NotFoundException(`Email account "${id}" not found`);
    }
    await updateEmailAccount(id, {
      status: EmailAccountStatus.Disconnected,
      deletedAt: new Date(),
    });
    return { id, status: EmailAccountStatus.Disconnected };
  }
}
