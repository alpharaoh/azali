import { Injectable } from "@nestjs/common";
import { selectActiveMembership } from "@/db/queries/select/one/selectActiveMembership";

@Injectable()
export class UsersService {
  async getActiveMembership(
    userId: string,
    activeOrganizationId?: string | null,
  ) {
    return selectActiveMembership(userId, activeOrganizationId);
  }
}
