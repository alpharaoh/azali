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
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { ListShipmentsDto } from "./dto/list-shipments.dto";
import { ResolveReviewDto } from "./dto/resolve-review.dto";
import {
  ClassifyResponseDto,
  ListShipmentLinesResponseDto,
  ListShipmentsResponseDto,
  ShipmentResponseDto,
  ShipmentStatsResponseDto,
} from "./dto/shipment.response.dto";
import { UpdateShipmentDto } from "./dto/update-shipment.dto";
import { ShipmentsService } from "./shipments.service";

@ApiTags("Shipments")
@Controller("shipments")
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  /** Create a shipment for a client in the active organization. */
  @Post()
  @ApiOperation({
    summary: "Create a shipment",
    description:
      "Creates a shipment for one of the organization's clients. The reference must be unique within the organization; stage and status default to the start of the pipeline (intake, on autopilot).",
  })
  @ApiCreatedResponse({
    type: ShipmentResponseDto,
    description: "The newly created shipment.",
  })
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

  /** List shipments with the pipeline/review-queue filter set. */
  @Get()
  @ApiOperation({
    summary: "List shipments",
    description:
      "Returns the organization's shipments with the full pipeline filter set: stage, status, client, review type, value bounds (cents), and free-text search across reference, entry number, and client name. Supports sorting and offset pagination; the response includes the total count for the current filters.",
  })
  @ApiOkResponse({
    type: ListShipmentsResponseDto,
    description: "A page of shipments plus the total count.",
  })
  findAll(
    @Session() session: UserSession<typeof auth>,
    @Query() query: ListShipmentsDto,
  ) {
    return this.shipmentsService.findAll(
      getActiveOrganizationId(session),
      query,
    );
  }

  /** Aggregate counts by status and review type. */
  // Must precede :id so "stats" isn't captured as an id.
  @Get("stats")
  @ApiOperation({
    summary: "Get shipment stats",
    description:
      "Returns aggregate shipment counts for the organization, grouped by status and review type — suitable for dashboard overviews and queue filters.",
  })
  @ApiOkResponse({
    type: ShipmentStatsResponseDto,
    description: "Counts grouped by status and review type.",
  })
  stats(@Session() session: UserSession<typeof auth>) {
    return this.shipmentsService.stats(getActiveOrganizationId(session));
  }

  /** Fetch a single shipment by id. */
  @Get(":id")
  @ApiOperation({
    summary: "Get a shipment",
    description:
      "Fetches one shipment by id, scoped to the active organization. Includes any pending review details and the summary snapshot.",
  })
  @ApiParam({ name: "id", description: "Shipment id." })
  @ApiOkResponse({ type: ShipmentResponseDto, description: "The shipment." })
  findOne(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.shipmentsService.findOne(getActiveOrganizationId(session), id);
  }

  /** Partially update a shipment. */
  @Patch(":id")
  @ApiOperation({
    summary: "Update a shipment",
    description:
      "Partially updates a shipment — only the provided fields change. Prefer appending shipment events for anything that belongs in the audit record; this endpoint is for correcting current-state fields.",
  })
  @ApiParam({ name: "id", description: "Shipment id." })
  @ApiOkResponse({
    type: ShipmentResponseDto,
    description: "The updated shipment.",
  })
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

  /** Delete a shipment. */
  @Delete(":id")
  @ApiOperation({
    summary: "Delete a shipment",
    description:
      "Deletes a shipment. Its event history is preserved in the audit record.",
  })
  @ApiParam({ name: "id", description: "Shipment id." })
  @ApiOkResponse({
    type: ShipmentResponseDto,
    description: "The deleted shipment.",
  })
  remove(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.shipmentsService.remove(getActiveOrganizationId(session), id);
  }

  /** Resolve the shipment's open review. */
  @Post(":id/resolve")
  @ApiOperation({
    summary: "Resolve a review",
    description:
      "Resolves the shipment's pending review with one of three actions: approved (accept the AI proposal), corrected (broker supplied a different answer), or info_requested (more information needed — the shipment stays in the review queue). Approval and correction append a review_resolved event, advance the stage, and clear the review fields. Returns 409 when there is no pending review.",
  })
  @ApiParam({ name: "id", description: "Shipment id." })
  @ApiOkResponse({
    type: ShipmentResponseDto,
    description: "The shipment after resolution.",
  })
  resolve(
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

  /** The shipment's entry lines. */
  @Get(":id/lines")
  @ApiOperation({
    summary: "List shipment lines",
    description:
      "Returns the shipment's entry line items — one per invoice line — each with its HTS classification, confidence, and whether the code was reused from the client's product library.",
  })
  @ApiParam({ name: "id", description: "Shipment id." })
  @ApiOkResponse({
    type: ListShipmentLinesResponseDto,
    description: "The shipment's lines, in line order.",
  })
  lines(@Session() session: UserSession<typeof auth>, @Param("id") id: string) {
    return this.shipmentsService.lines(getActiveOrganizationId(session), id);
  }

  /** Run (or re-run) the AI classification for a shipment. */
  @Post(":id/classify")
  @ApiOperation({
    summary: "Classify a shipment",
    description:
      "Runs the AI classification for the shipment's documents: candidate tariff headings are analyzed under the General Rules of Interpretation with the binding Section and Chapter Notes, checked against published customs rulings, and resolved to a 10-digit HTS code with duty details. The result appears on the shipment timeline; uncertain classifications are routed to review. Runs asynchronously — safe to call again to re-classify.",
  })
  @ApiParam({ name: "id", description: "Shipment id." })
  @ApiCreatedResponse({
    type: ClassifyResponseDto,
    description: "Ids of the dispatched classification runs.",
  })
  classify(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.shipmentsService.classify(
      getActiveOrganizationId(session),
      session.user.id,
      id,
    );
  }

  /** Broker fast-forward: stop waiting for related emails, classify now. */
  @Post(":id/skip-email-intake")
  @ApiOperation({
    summary: "Skip the email intake window",
    description:
      "For shipments created from a connected inbox: stops waiting for further related emails and starts classification immediately. Use when all the shipment's paperwork has already arrived. Emails received afterwards start a new shipment.",
  })
  @ApiParam({ name: "id", description: "Shipment id." })
  skipEmailIntake(
    @Session() session: UserSession<typeof auth>,
    @Param("id") id: string,
  ) {
    return this.shipmentsService.skipEmailIntake(
      getActiveOrganizationId(session),
      session.user.id,
      id,
    );
  }
}
