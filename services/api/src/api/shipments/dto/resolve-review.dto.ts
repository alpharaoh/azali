import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export enum ReviewResolutionAction {
  Approved = "approved",
  Corrected = "corrected",
  InfoRequested = "info_requested",
}

export const resolveReviewSchema = z.object({
  action: z
    .enum(ReviewResolutionAction)
    .describe(
      "approved accepts the AI proposal; corrected substitutes the broker's answer; info_requested keeps the shipment in the review queue pending more information.",
    ),
  alternate: z
    .string()
    .min(1)
    .optional()
    .describe('The value the broker chose instead, when action is "corrected".'),
  note: z
    .string()
    .min(1)
    .optional()
    .describe("Broker note recorded on the review_resolved event."),
});

export class ResolveReviewDto extends createZodDto(resolveReviewSchema) {}
