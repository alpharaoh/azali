import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getActiveOrganizationId } from "@/db/lib/getActiveOrganizationId";
import type { auth } from "@/lib/auth";
import { IngestDocumentsDto } from "./dto/ingest-documents.dto";
import {
  IngestDocumentsResponseDto,
  ListShipmentDocumentsResponseDto,
  UploadDocumentsResponseDto,
} from "./dto/shipment-document.response.dto";
import { UploadDocumentsDto } from "./dto/upload-documents.dto";
import { ShipmentDocumentsService } from "./shipment-documents.service";

// Documents ride under the shipments resource; the static "documents" segment
// safely coexists with ShipmentsController's ":id" routes (the router prefers
// static segments over params).
@ApiTags("Shipment Documents")
@Controller("shipments")
export class ShipmentDocumentsController {
  constructor(
    private readonly shipmentDocumentsService: ShipmentDocumentsService,
  ) {}

  /** Presigned S3 PUT URLs — the browser uploads file bodies directly to S3. */
  @Post("documents/upload")
  @ApiOperation({
    summary: "Get document upload URLs",
    description:
      "Step 1 of intake: returns a presigned upload URL per file. Upload each file body directly to its URL with an HTTP PUT (the Content-Type must match), then confirm the batch via POST /shipments/documents. File keys are assigned by the server; upload URLs expire after 5 minutes.",
  })
  @ApiCreatedResponse({
    type: UploadDocumentsResponseDto,
    description: "One presigned upload target per requested file.",
  })
  upload(
    @Session() session: UserSession<typeof auth>,
    @Body() dto: UploadDocumentsDto,
  ) {
    return this.shipmentDocumentsService.upload(
      getActiveOrganizationId(session),
      dto,
    );
  }

  /** Called after the S3 uploads finish — kickstarts the ingestion run. */
  @Post("documents")
  @ApiOperation({
    summary: "Ingest uploaded documents",
    description:
      "Step 2 of intake: confirms a batch of uploaded documents and kickstarts the asynchronous shipment process (classification, extraction, matching). Each file carries its intake category (commercial invoice, packing list, bill of lading, arrival notice, other). Keys must belong to the active organization.",
  })
  @ApiCreatedResponse({
    type: IngestDocumentsResponseDto,
    description: "Ids of the dispatched ingestion events.",
  })
  ingest(
    @Session() session: UserSession<typeof auth>,
    @Body() dto: IngestDocumentsDto,
  ) {
    return this.shipmentDocumentsService.ingest(
      getActiveOrganizationId(session),
      session.user.id,
      dto,
    );
  }

  @Get(":id/documents")
  @ApiOperation({
    summary: "List shipment documents",
    description:
      "Returns the documents attached to a shipment, including the extracted fields and summary for each, plus short-lived links to view the original file and its preview image. Links expire after 5 minutes — request the list again for fresh ones.",
  })
  @ApiOkResponse({
    type: ListShipmentDocumentsResponseDto,
    description: "The shipment's documents, oldest first.",
  })
  list(@Session() session: UserSession<typeof auth>, @Param("id") id: string) {
    return this.shipmentDocumentsService.list(
      getActiveOrganizationId(session),
      id,
    );
  }
}
