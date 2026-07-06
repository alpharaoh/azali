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
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
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

@ApiTags("Clients")
@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  /** Create a client (importer of record) in the active organization. */
  @Post()
  @ApiOperation({
    summary: "Create a client",
    description:
      "Creates an importer client in the active organization. The client owns shipments and carries the customs identity used on entries: IOR number, continuous bond, primary origin country, and preferred ports of entry.",
  })
  @ApiCreatedResponse({
    type: ClientResponseDto,
    description: "The newly created client.",
  })
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

  /** List clients with filtering, search, sort, and pagination. */
  @Get()
  @ApiOperation({
    summary: "List clients",
    description:
      "Returns the organization's clients with optional filtering by autonomy and status, free-text search on the name, sorting, and offset pagination. The response includes the total row count for the current filters.",
  })
  @ApiOkResponse({
    type: ListClientsResponseDto,
    description: "A page of clients plus the total count.",
  })
  findAll(
    @Session() session: UserSession<typeof auth>,
    @Query() query: ListClientsDto,
  ) {
    return this.clientsService.findAll(getActiveOrganizationId(session), query);
  }

  /** Fetch a single client by id. */
  @Get(":id")
  @ApiOperation({
    summary: "Get a client",
    description: "Fetches one client by id, scoped to the active organization.",
  })
  @ApiParam({ name: "id", description: "Client id." })
  @ApiOkResponse({ type: ClientResponseDto, description: "The client." })
  findOne(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.clientsService.findOne(getActiveOrganizationId(session), id);
  }

  /** Partially update a client. */
  @Patch(":id")
  @ApiOperation({
    summary: "Update a client",
    description:
      "Partially updates a client — only the provided fields change. Use this to pause/resume automation (status), adjust autonomy, or correct customs identifiers.",
  })
  @ApiParam({ name: "id", description: "Client id." })
  @ApiOkResponse({
    type: ClientResponseDto,
    description: "The updated client.",
  })
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

  /** Delete a client. */
  @Delete(":id")
  @ApiOperation({
    summary: "Delete a client",
    description:
      "Deletes a client. Deleted clients no longer appear in lists or lookups; their history is preserved for the record.",
  })
  @ApiParam({ name: "id", description: "Client id." })
  @ApiOkResponse({
    type: ClientResponseDto,
    description: "The deleted client.",
  })
  remove(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.clientsService.remove(getActiveOrganizationId(session), id);
  }
}
