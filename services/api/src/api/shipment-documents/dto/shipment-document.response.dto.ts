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
});

export class IngestDocumentsResponseDto extends createZodDto(
  ingestDocumentsResponseSchema,
) {}
