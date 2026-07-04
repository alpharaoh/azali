import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { StructureSchema, PptxOperationSchema } from "./sessions.schemas";

export class CreateSessionDto extends createZodDto(
  z.object({
    s3Key: z.string().min(1),
  }),
) {}

export class CreateSessionResponseDto extends createZodDto(
  z.object({
    sessionId: z.string(),
    structure: StructureSchema,
  }),
) {}

export class ApplyOperationsDto extends createZodDto(
  z.object({
    operations: z.array(PptxOperationSchema),
  }),
) {}

export class ApplyOperationsResponseDto extends createZodDto(
  z.object({
    sessionId: z.string(),
    structure: StructureSchema,
    operationsApplied: z.number(),
    totalOperations: z.number(),
  }),
) {}
