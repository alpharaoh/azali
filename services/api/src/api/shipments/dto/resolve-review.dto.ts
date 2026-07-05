import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export enum ReviewResolutionAction {
  Approved = "approved",
  Corrected = "corrected",
  InfoRequested = "info_requested",
}

export const resolveReviewSchema = z.object({
  action: z.enum(ReviewResolutionAction),
  /** The alternate value chosen when action is "corrected". */
  alternate: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});

export class ResolveReviewDto extends createZodDto(resolveReviewSchema) {}
