import { Controller, Delete, Get, Param, Post } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getActiveOrganizationId } from "@/db/lib/getActiveOrganizationId";
import type { auth } from "@/lib/auth";
import {
  ConnectEmailAccountResponseDto,
  ListEmailAccountsResponseDto,
} from "./dto/email-account.response.dto";
import { EmailAccountsService } from "./email-accounts.service";

@ApiTags("Email Accounts")
@Controller("email-accounts")
export class EmailAccountsController {
  constructor(private readonly emailAccountsService: EmailAccountsService) {}

  @Post("connect")
  @ApiOperation({
    summary: "Connect an inbox",
    description:
      "Returns a single-use hosted URL where the user connects any mail provider (Gmail, Outlook, IMAP). Once connected, new inbox emails with shipment documents flow into shipments automatically.",
  })
  @ApiCreatedResponse({ type: ConnectEmailAccountResponseDto })
  connect(@Session() session: UserSession<typeof auth>) {
    return this.emailAccountsService.connect(
      getActiveOrganizationId(session),
      session.user.id,
    );
  }

  @Get()
  @ApiOperation({
    summary: "List connected inboxes",
    description:
      "The organization's connected email accounts and their delivery status.",
  })
  @ApiOkResponse({ type: ListEmailAccountsResponseDto })
  list(@Session() session: UserSession<typeof auth>) {
    return this.emailAccountsService.list(getActiveOrganizationId(session));
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Disconnect an inbox",
    description:
      "Stops ingesting from this inbox. Emails already turned into shipments are unaffected.",
  })
  disconnect(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.emailAccountsService.disconnect(
      getActiveOrganizationId(session),
      id,
    );
  }
}
