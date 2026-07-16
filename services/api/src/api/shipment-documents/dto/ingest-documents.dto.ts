import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { ShipmentDocumentCategory } from "@/db/schema";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES } from "./upload-documents.dto";

export const ingestDocumentsSchema = z.object({
  files: z
    .array(
      z.object({
        key: z
          .string()
          .min(1)
          .max(500)
          .describe("File key returned by POST /shipments/documents/upload."),
        fileName: z.string().min(1).max(200).describe("Original file name."),
        contentType: z
          .string()
          .min(1)
          .max(120)
          .describe("MIME type of the file."),
        size: z
          .number()
          .int()
          .min(1)
          .max(MAX_UPLOAD_BYTES)
          .describe("File size in bytes."),
        category: z
          .enum(ShipmentDocumentCategory)
          .default(ShipmentDocumentCategory.Other)
          .describe(
            "Intake category: commercial_invoice, packing_list, bill_of_lading, arrival_notice, or other.",
          ),
      }),
    )
    .min(1)
    .max(MAX_UPLOAD_FILES)
    .describe("The uploaded files to ingest (max 25 per request)."),
});

export class IngestDocumentsDto extends createZodDto(ingestDocumentsSchema) {}
