import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { auth } from "@/lib/auth";
import { MeResponseDto } from "./dto/me.response.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOkResponse({ type: MeResponseDto })
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
