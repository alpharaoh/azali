import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { auth } from "@/lib/auth";
import { MeResponseDto } from "./dto/me.response.dto";
import { UsersService } from "./users.service";

@ApiTags("Users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** The signed-in user plus their active organization and membership. */
  @Get("me")
  @ApiOperation({
    summary: "Get the current user",
    description:
      "Returns the signed-in user together with their active organization and membership (role, joined date). Organization and member are null when the session has no active organization.",
  })
  @ApiOkResponse({
    type: MeResponseDto,
    description: "The current user, organization, and membership.",
  })
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
