import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const uploadUrlsResponseSchema = z.object({
  uploads: z.array(
    z.object({
      key: z.string(),
      /** Presigned S3 PUT URL — upload the raw file body here. */
      url: z.string(),
      fileName: z.string(),
      contentType: z.string(),
    }),
  ),
});

export class UploadUrlsResponseDto extends createZodDto(
  uploadUrlsResponseSchema,
) {}

export const ingestDocumentsResponseSchema = z.object({
  /** Inngest event ids for the dispatched ingestion run. */
  eventIds: z.array(z.string()),
});

export class IngestDocumentsResponseDto extends createZodDto(
  ingestDocumentsResponseSchema,
) {}
