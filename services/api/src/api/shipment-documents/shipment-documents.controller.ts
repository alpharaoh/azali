import { Body, Controller, Post } from "@nestjs/common";
import { ApiCreatedResponse } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getActiveOrganizationId } from "@/db/lib/getActiveOrganizationId";
import type { auth } from "@/lib/auth";
import { IngestDocumentsDto } from "./dto/ingest-documents.dto";
import {
  IngestDocumentsResponseDto,
  UploadDocumentsResponseDto,
} from "./dto/shipment-document.response.dto";
import { UploadDocumentsDto } from "./dto/upload-documents.dto";
import { ShipmentDocumentsService } from "./shipment-documents.service";

// Documents ride under the shipments resource; the static "documents" segment
// safely coexists with ShipmentsController's ":id" routes (the router prefers
// static segments over params).
@Controller("shipments")
export class ShipmentDocumentsController {
  constructor(
    private readonly shipmentDocumentsService: ShipmentDocumentsService,
  ) {}

  /** Presigned S3 PUT URLs — the browser uploads file bodies directly to S3. */
  @Post("documents/upload")
  @ApiCreatedResponse({ type: UploadDocumentsResponseDto })
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
  @ApiCreatedResponse({ type: IngestDocumentsResponseDto })
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
}
