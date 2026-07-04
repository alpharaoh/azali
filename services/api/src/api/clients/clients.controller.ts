import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { auth } from "@/lib/auth";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { ListClientsDto } from "./dto/list-clients.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

function getActiveOrganizationId(session: UserSession<typeof auth>) {
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) {
    throw new ForbiddenException("No active organization");
  }

  return organizationId;
}

@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(
    @Session() session: UserSession<typeof auth>,
    @Body() dto: CreateClientDto,
  ) {
    return this.clientsService.create(
      getActiveOrganizationId(session),
      session.user.id,
      dto,
    );
  }

  @Get()
  findAll(
    @Session() session: UserSession<typeof auth>,
    @Query() query: ListClientsDto,
  ) {
    return this.clientsService.findAll(getActiveOrganizationId(session), query);
  }

  @Get(":id")
  findOne(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.clientsService.findOne(getActiveOrganizationId(session), id);
  }

  @Patch(":id")
  update(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(
      getActiveOrganizationId(session),
      id,
      dto,
    );
  }

  @Delete(":id")
  remove(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.clientsService.remove(getActiveOrganizationId(session), id);
  }
}
