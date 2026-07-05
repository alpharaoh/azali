import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
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

// Events are an append-only sub-resource of shipments: no update or delete
// endpoints, by design. The static "events" segment safely coexists with the
// sibling ":id" route in ShipmentsController — the router prefers static
// segments over params.
@Controller("shipments")
export class ShipmentEventsController {
  constructor(private readonly shipmentEventsService: ShipmentEventsService) {}

  /** Org-wide event feed across all shipments (e.g. the autopilot log). */
  @Get("events")
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

  /** One shipment's timeline. */
  @Get(":shipmentId/events")
  @ApiOkResponse({ type: ListShipmentEventsResponseDto })
  findByShipment(
    @Session() session: UserSession<typeof auth>,
    @Param("shipmentId") shipmentId: string,
    @Query() query: ListShipmentEventsDto,
  ) {
    return this.shipmentEventsService.findByShipment(
      getActiveOrganizationId(session),
      shipmentId,
      query,
    );
  }

  @Post(":shipmentId/events")
  @ApiCreatedResponse({ type: ShipmentEventResponseDto })
  create(
    @Session() session: UserSession<typeof auth>,
    @Param("shipmentId") shipmentId: string,
    @Body() dto: CreateShipmentEventDto,
  ) {
    return this.shipmentEventsService.create(
      getActiveOrganizationId(session),
      session.user.id,
      shipmentId,
      dto,
    );
  }
}
