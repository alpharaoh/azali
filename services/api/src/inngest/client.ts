import { Inngest } from "inngest";
import { createLogger } from "@/lib/logger";

export const inngest = new Inngest({
  id: "azali-inngest",
  // Handlers log through ctx.logger — Inngest wraps this instance so step
  // replays don't emit duplicate lines.
  logger: createLogger("inngest"),
});
