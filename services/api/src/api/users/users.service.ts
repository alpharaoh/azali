import { Injectable } from "@nestjs/common";
import { listMemberships } from "@/db/queries/select/many/listMemberships";
import { selectOrganization } from "@/db/queries/select/one/selectOrganization";

@Injectable()
export class UsersService {
  /** The user's membership in their active organization (or their first
   * membership when the session names none), with the organization row. */
  async getActiveMembership(
    userId: string,
    activeOrganizationId?: string | null,
  ) {
    const {
      data: [membership],
    } = await listMemberships(
      {
        userId,
        ...(activeOrganizationId
          ? { organizationId: activeOrganizationId }
          : {}),
      },
      undefined,
      1,
    );
    if (!membership) return null;

    const organization = await selectOrganization(membership.organizationId);
    if (!organization) return null;

    return { ...membership, organization };
  }
}
