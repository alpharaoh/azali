import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES } from "./create-upload-urls.dto";

/** The intake document set — mirrors what arrives with a typical entry. */
export const documentCategories = [
  "commercial_invoice",
  "packing_list",
  "bill_of_lading",
  "arrival_notice",
  "other",
] as const;

export const ingestDocumentsSchema = z.object({
  files: z
    .array(
      z.object({
        /** S3 object key returned by the upload-urls endpoint. */
        key: z.string().min(1).max(500),
        fileName: z.string().min(1).max(200),
        contentType: z.string().min(1).max(120),
        size: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
        category: z.enum(documentCategories).default("other"),
      }),
    )
    .min(1)
    .max(MAX_UPLOAD_FILES),
});

export class IngestDocumentsDto extends createZodDto(ingestDocumentsSchema) {}
