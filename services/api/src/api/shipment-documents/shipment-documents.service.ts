import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { listShipmentDocuments } from "@/db/queries/select/many/listShipmentDocuments";
import { selectShipment } from "@/db/queries/select/one/selectShipment";
import type { DocumentExtraction } from "@/db/schema";
import { ShipmentDocumentStatus } from "@/db/schema";
import { env } from "@/env";
import { inngest } from "@/inngest/client";
import {
  SHIPMENT_DOCUMENTS_UPLOADED_EVENT,
  type ShipmentDocumentsUploadedEvent,
} from "@/inngest/functions/ingestShipmentDocuments";
import { BlobStorageService } from "@/services/external/s3/service";
import type { IngestDocumentsDto } from "./dto/ingest-documents.dto";
import type { UploadDocumentsDto } from "./dto/upload-documents.dto";

function documentKeyPrefix(organizationId: string) {
  return `organizations/${organizationId}/shipment-documents/`;
}

@Injectable()
export class ShipmentDocumentsService {
  async upload(organizationId: string, dto: UploadDocumentsDto) {
    const uploads = await Promise.all(
      dto.files.map(async (file) => {
        const safeName =
          file.fileName
            .toLowerCase()
            .replace(/[^a-z0-9.]+/g, "-")
            .replace(/^-+|-+$/g, "") || "document";
        const key = `${documentKeyPrefix(organizationId)}${randomUUID()}/${safeName}`;

        const url = await BlobStorageService.getUploadUrl({
          key,
          contentType: file.contentType,
        });

        return {
          key,
          url,
          fileName: file.fileName,
          contentType: file.contentType,
        };
      }),
    );

    return { uploads };
  }

  async ingest(
    organizationId: string,
    userId: string,
    dto: IngestDocumentsDto,
  ) {
    const prefix = documentKeyPrefix(organizationId);
    const outsideOrg = dto.files.find((file) => !file.key.startsWith(prefix));
    if (outsideOrg) {
      throw new BadRequestException(
        `File key does not belong to this organization: ${outsideOrg.key}`,
      );
    }

    const payload: ShipmentDocumentsUploadedEvent["data"] = {
      organizationId,
      userId,
      bucket: env.AWS_S3_BUCKET,
      files: dto.files,
    };

    const result = await inngest.send({
      name: SHIPMENT_DOCUMENTS_UPLOADED_EVENT,
      data: payload,
    });

    return { eventIds: result.ids };
  }

  async list(organizationId: string, shipmentId: string) {
    const shipment = await selectShipment(shipmentId, organizationId);
    if (!shipment) {
      throw new NotFoundException("Shipment not found");
    }

    const { data } = await listShipmentDocuments({
      organizationId,
      shipmentId,
    });

    const documents = await Promise.all(
      data.map(async (doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        contentType: doc.contentType,
        sizeBytes: doc.sizeBytes,
        category: doc.category,
        status: doc.status,
        pageCount: doc.pageCount,
        extraction:
          doc.status === ShipmentDocumentStatus.Extracted
            ? (doc.extraction as unknown as DocumentExtraction)
            : null,
        fileUrl: await BlobStorageService.getDownloadUrl({
          key: doc.storageKey,
        }),
        previewUrl: doc.previewKey
          ? await BlobStorageService.getDownloadUrl({
              key: doc.previewKey,
            })
          : null,
        createdAt: doc.createdAt.toISOString(),
      })),
    );

    return { documents };
  }
}
