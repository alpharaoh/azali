import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getActiveOrganizationId } from "@/db/lib/getActiveOrganizationId";
import type { auth } from "@/lib/auth";
import { OrganizationResponseDto } from "./dto/organization.response.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { OrganizationService } from "./organization.service";

/** The session's active organization — a contextual singleton, like /users/me. */
@ApiTags("Organization")
@Controller("organization")
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  /** Fetch the session's active organization profile. */
  @Get()
  @ApiOperation({
    summary: "Get the active organization",
    description:
      "Returns the profile of the session's active organization: name, derived slug, description, website, contact email, and CBP filer code.",
  })
  @ApiOkResponse({
    type: OrganizationResponseDto,
    description: "The active organization's profile.",
  })
  getCurrent(@Session() session: UserSession<typeof auth>) {
    return this.organizationService.getCurrent(
      getActiveOrganizationId(session),
      session.user.id,
    );
  }

  /** Update the active organization (owners and admins only). */
  @Patch()
  @ApiOperation({
    summary: "Update the active organization",
    description:
      "Updates the organization profile. Only owners and admins may call this. The slug is derived from the name server-side (with a suffix on collision) and cannot be set directly; the filer code is uppercased.",
  })
  @ApiOkResponse({
    type: OrganizationResponseDto,
    description: "The updated organization profile.",
  })
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
