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
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { ListShipmentsDto } from "./dto/list-shipments.dto";
import { ResolveReviewDto } from "./dto/resolve-review.dto";
import {
  ListShipmentsResponseDto,
  ShipmentResponseDto,
  ShipmentStatsResponseDto,
} from "./dto/shipment.response.dto";
import { UpdateShipmentDto } from "./dto/update-shipment.dto";
import { ShipmentsService } from "./shipments.service";

@Controller("shipments")
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @ApiCreatedResponse({ type: ShipmentResponseDto })
  create(
    @Session() session: UserSession<typeof auth>,
    @Body() dto: CreateShipmentDto,
  ) {
    return this.shipmentsService.create(
      getActiveOrganizationId(session),
      session.user.id,
      dto,
    );
  }

  @Get()
  @ApiOkResponse({ type: ListShipmentsResponseDto })
  findAll(
    @Session() session: UserSession<typeof auth>,
    @Query() query: ListShipmentsDto,
  ) {
    return this.shipmentsService.findAll(
      getActiveOrganizationId(session),
      query,
    );
  }

  // Must precede :id so "stats" isn't captured as an id.
  @Get("stats")
  @ApiOkResponse({ type: ShipmentStatsResponseDto })
  stats(@Session() session: UserSession<typeof auth>) {
    return this.shipmentsService.stats(getActiveOrganizationId(session));
  }

  @Get(":id")
  @ApiOkResponse({ type: ShipmentResponseDto })
  findOne(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.shipmentsService.findOne(getActiveOrganizationId(session), id);
  }

  @Patch(":id")
  @ApiOkResponse({ type: ShipmentResponseDto })
  update(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.shipmentsService.update(
      getActiveOrganizationId(session),
      id,
      dto,
    );
  }

  @Delete(":id")
  @ApiOkResponse({ type: ShipmentResponseDto })
  remove(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.shipmentsService.remove(getActiveOrganizationId(session), id);
  }

  @Post(":id/resolve-review")
  @ApiOkResponse({ type: ShipmentResponseDto })
  resolveReview(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
    @Body() dto: ResolveReviewDto,
  ) {
    return this.shipmentsService.resolveReview(
      getActiveOrganizationId(session),
      session.user.id,
      id,
      dto,
    );
  }
}
