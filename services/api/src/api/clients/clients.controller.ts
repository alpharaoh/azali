import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getActiveOrganizationId } from "@/db/lib/getActiveOrganizationId";
import type { auth } from "@/lib/auth";
import { ClientsService } from "./clients.service";
import {
  ClientResponseDto,
  ListClientsResponseDto,
} from "./dto/client.response.dto";
import { CreateClientDto } from "./dto/create-client.dto";
import { ListClientsDto } from "./dto/list-clients.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @ApiCreatedResponse({ type: ClientResponseDto })
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
  @ApiOkResponse({ type: ListClientsResponseDto })
  findAll(
    @Session() session: UserSession<typeof auth>,
    @Query() query: ListClientsDto,
  ) {
    return this.clientsService.findAll(getActiveOrganizationId(session), query);
  }

  @Get(":id")
  @ApiOkResponse({ type: ClientResponseDto })
  findOne(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.clientsService.findOne(getActiveOrganizationId(session), id);
  }

  @Patch(":id")
  @ApiOkResponse({ type: ClientResponseDto })
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
  @ApiOkResponse({ type: ClientResponseDto })
  remove(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.clientsService.remove(getActiveOrganizationId(session), id);
  }
}
