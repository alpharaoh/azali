import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const uploadDocumentsResponseSchema = z.object({
  uploads: z
    .array(
      z.object({
        key: z
          .string()
          .describe(
            "File key identifying the upload; pass it back when ingesting.",
          ),
        url: z
          .string()
          .describe(
            "Presigned upload URL — PUT the raw file body here before it expires (5 minutes).",
          ),
        fileName: z.string().describe("Original file name, echoed back."),
        contentType: z
          .string()
          .describe("MIME type the upload PUT must use as its Content-Type."),
      }),
    )
    .describe("One upload target per requested file, in request order."),
});

export class UploadDocumentsResponseDto extends createZodDto(
  uploadDocumentsResponseSchema,
) {}

export const ingestDocumentsResponseSchema = z.object({
  eventIds: z
    .array(z.string())
    .describe("Ids of the ingestion runs started for this batch."),
  shipmentId: z
    .string()
    .describe(
      "Id of the shipment pre-created for this batch — it exists (and is watchable) from this moment, while ingestion fills it in.",
    ),
});

export class IngestDocumentsResponseDto extends createZodDto(
  ingestDocumentsResponseSchema,
) {}

export const listShipmentDocumentsResponseSchema = z.object({
  documents: z
    .array(
      z.object({
        id: z.string().describe("Document id."),
        fileName: z.string().describe("Original file name."),
        contentType: z.string().describe("MIME type of the file."),
        sizeBytes: z.number().describe("File size in bytes."),
        category: z
          .string()
          .describe(
            "Intake category: commercial_invoice, packing_list, bill_of_lading, arrival_notice, or other.",
          ),
        status: z
          .string()
          .describe(
            "Processing status: pending (queued), extracted (data available), or failed.",
          ),
        pageCount: z
          .number()
          .nullable()
          .describe("Number of pages, when known."),
        extraction: z
          .object({
            summary: z
              .string()
              .describe("A short summary of the document's contents."),
            fields: z
              .array(z.object({ label: z.string(), value: z.string() }))
              .describe("The document's structured data as key-value pairs."),
          })
          .nullable()
          .describe("Extracted data — available once processing completes."),
        fileUrl: z
          .string()
          .describe(
            "Short-lived link to the original file. Expires after 5 minutes; request the list again for a fresh one.",
          ),
        previewUrl: z
          .string()
          .nullable()
          .describe(
            "Short-lived link to a first-page preview image, when available.",
          ),
        createdAt: z.string().describe("When the document was received."),
      }),
    )
    .describe("The shipment's documents, oldest first."),
});

export class ListShipmentDocumentsResponseDto extends createZodDto(
  listShipmentDocumentsResponseSchema,
) {}
