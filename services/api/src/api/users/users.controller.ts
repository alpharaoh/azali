import { Controller, Get } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { auth } from "@/lib/auth";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async getProfile(@Session() session: UserSession<typeof auth>) {
    const membership = await this.usersService.getActiveMembership(
      session.user.id,
      session.session.activeOrganizationId,
    );

    return {
      user: session.user,
      organization: membership?.organization ?? null,
      member: membership
        ? {
            id: membership.id,
            role: membership.role,
            createdAt: membership.createdAt,
          }
        : null,
    };
  }
}
