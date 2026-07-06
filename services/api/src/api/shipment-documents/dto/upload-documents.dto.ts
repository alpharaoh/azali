import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const MAX_UPLOAD_FILES = 25;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const uploadDocumentsSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1).max(200),
        contentType: z.string().min(1).max(120),
        size: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
      }),
    )
    .min(1)
    .max(MAX_UPLOAD_FILES),
});

export class UploadDocumentsDto extends createZodDto(uploadDocumentsSchema) {}
