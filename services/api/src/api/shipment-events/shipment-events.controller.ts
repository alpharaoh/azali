import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getActiveOrganizationId } from "@/db/lib/getActiveOrganizationId";
import type { auth } from "@/lib/auth";
import { CreateShipmentEventDto } from "./dto/create-shipment-event.dto";
import { ListShipmentEventsDto } from "./dto/list-shipment-events.dto";
import {
  ListShipmentEventsResponseDto,
  ShipmentEventResponseDto,
} from "./dto/shipment-event.response.dto";
import { ShipmentEventsService } from "./shipment-events.service";

// Events are append-only: no update or delete endpoints, by design.
@Controller("shipment-events")
export class ShipmentEventsController {
  constructor(private readonly shipmentEventsService: ShipmentEventsService) {}

  @Post()
  @ApiCreatedResponse({ type: ShipmentEventResponseDto })
  create(
    @Session() session: UserSession<typeof auth>,
    @Body() dto: CreateShipmentEventDto,
  ) {
    return this.shipmentEventsService.create(
      getActiveOrganizationId(session),
      session.user.id,
      dto,
    );
  }

  @Get()
  @ApiOkResponse({ type: ListShipmentEventsResponseDto })
  findAll(
    @Session() session: UserSession<typeof auth>,
    @Query() query: ListShipmentEventsDto,
  ) {
    return this.shipmentEventsService.findAll(
      getActiveOrganizationId(session),
      query,
    );
  }
}
