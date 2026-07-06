import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getActiveOrganizationId } from "@/db/lib/getActiveOrganizationId";
import type { auth } from "@/lib/auth";
import { OrganizationResponseDto } from "./dto/organization.response.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { OrganizationService } from "./organization.service";

/** The session's active organization — a contextual singleton, like /users/me. */
@Controller("organization")
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @ApiOkResponse({ type: OrganizationResponseDto })
  getCurrent(@Session() session: UserSession<typeof auth>) {
    return this.organizationService.getCurrent(
      getActiveOrganizationId(session),
      session.user.id,
    );
  }

  @Patch()
  @ApiOkResponse({ type: OrganizationResponseDto })
  update(
    @Session() session: UserSession<typeof auth>,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.updateCurrent(
      getActiveOrganizationId(session),
      session.user.id,
      dto,
    );
  }
}
