import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const MAX_UPLOAD_FILES = 25;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const uploadDocumentsSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1).max(200).describe("Original file name."),
        contentType: z
          .string()
          .min(1)
          .max(120)
          .describe(
            "MIME type of the file; the upload PUT must use the same Content-Type.",
          ),
        size: z
          .number()
          .int()
          .min(1)
          .max(MAX_UPLOAD_BYTES)
          .describe("File size in bytes (max 50 MB)."),
      }),
    )
    .min(1)
    .max(MAX_UPLOAD_FILES)
    .describe("The files to upload (max 25 per request)."),
});

export class UploadDocumentsDto extends createZodDto(uploadDocumentsSchema) {}
