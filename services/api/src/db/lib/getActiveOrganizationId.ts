import { ForbiddenException } from "@nestjs/common";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import type { auth } from "@/lib/auth";

export function getActiveOrganizationId(session: UserSession<typeof auth>) {
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) {
    throw new ForbiddenException("No active organization");
  }

  return organizationId;
}
