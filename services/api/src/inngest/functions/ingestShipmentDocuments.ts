import type { Logger } from "@nestjs/common";
import { inngest } from "../client";

export const SHIPMENT_DOCUMENTS_UPLOADED_EVENT =
  "shipment/documents.uploaded" as const;

export type ShipmentDocumentsUploadedEvent = {
  data: {
    organizationId: string;
    userId: string;
    bucket: string;
    files: Array<{
      key: string;
      fileName: string;
      contentType: string;
      size: number;
      category:
        | "commercial_invoice"
        | "packing_list"
        | "bill_of_lading"
        | "arrival_notice"
        | "other";
    }>;
  };
};

/**
 * Kickstarts the shipment process from a batch of uploaded documents.
 * For now it only logs the received files; extraction/classification steps
 * will hang off this function later.
 */
export const ingestShipmentDocuments = (dependencies: { logger: Logger }) => {
  return inngest.createFunction(
    {
      id: "ingest-shipment-documents",
      triggers: [{ event: SHIPMENT_DOCUMENTS_UPLOADED_EVENT }],
    },
    async ({ event, step }) => {
      const { organizationId, userId, bucket, files } =
        event.data as ShipmentDocumentsUploadedEvent["data"];

      return await step.run("log-uploaded-documents", () => {
        dependencies.logger.log(
          `Ingesting ${files.length} shipment document(s) for organization ${organizationId} (uploaded by ${userId})`,
        );

        for (const file of files) {
          dependencies.logger.log(
            `Document received [${file.category}]: s3://${bucket}/${file.key} (${file.fileName}, ${file.contentType}, ${file.size} bytes)`,
          );
        }

        return { organizationId, receivedFiles: files.length };
      });
    },
  );
};
