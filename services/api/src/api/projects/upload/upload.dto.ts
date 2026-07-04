import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export class UploadUrlDto extends createZodDto(
  z.object({
    filename: z.string().min(1),
    contentType: z.string().min(1),
  }),
) {}

export class UploadUrlResponseDto extends createZodDto(
  z.object({
    uploadUrl: z.string(),
    key: z.string(),
  }),
) {}
