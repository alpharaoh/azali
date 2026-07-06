import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
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
@ApiTags("Shipment Events")
@Controller("shipments")
export class ShipmentEventsController {
  constructor(private readonly shipmentEventsService: ShipmentEventsService) {}

  /** Org-wide event feed across all shipments (e.g. the autopilot log). */
  @Get("events")
  @ApiOperation({
    summary: "List events across all shipments",
    description:
      "Returns the organization-wide event feed across every shipment, newest first — a complete audit trail of automated and manual activity. Filterable by type and actor; paginated with limit/offset.",
  })
  @ApiOkResponse({
    type: ListShipmentEventsResponseDto,
    description: "A page of events plus the total count.",
  })
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
  @ApiOperation({
    summary: "List a shipment's events",
    description:
      "Returns one shipment's timeline — documents received, extracted facts, agent trace steps, milestones, broker notes — oldest first. This is the contemporaneous record used to reconstruct any decision later (e.g. answering a CF-28).",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment id." })
  @ApiOkResponse({
    type: ListShipmentEventsResponseDto,
    description: "A page of the shipment's events plus the total count.",
  })
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

  /** Append an event to a shipment's timeline. */
  @Post(":shipmentId/events")
  @ApiOperation({
    summary: "Append a shipment event",
    description:
      "Appends an event to the shipment's timeline. Events are immutable — there is no update or delete. Appending a review_requested event also flips the shipment to needs_review and sets its review deadline and type.",
  })
  @ApiParam({ name: "shipmentId", description: "Shipment id." })
  @ApiCreatedResponse({
    type: ShipmentEventResponseDto,
    description: "The appended event.",
  })
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
