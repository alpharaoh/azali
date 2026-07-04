import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export class CreateProjectDto extends createZodDto(
  z.object({
    sourceS3Key: z.string().min(1),
    name: z.string().optional(),
  }),
) {}

export class UpdateProjectDto extends createZodDto(
  z.object({
    name: z.string().optional(),
    status: z.enum(["draft", "active"]).optional(),
  }),
) {}

export class CreateProjectResponseDto extends createZodDto(
  z.object({
    id: z.string(),
    status: z.string(),
    sourceS3Key: z.string(),
    name: z.string().optional(),
    createdAt: z.string(),
  }),
) {}
