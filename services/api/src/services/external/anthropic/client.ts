import { createAnthropic } from "@ai-sdk/anthropic";
import { env } from "@/env";

export const anthropic = createAnthropic({
  apiKey: env.ANTHROPIC_API_KEY ?? "",
  fetch: (input, init) => {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set — add it to services/api/.env to enable document extraction",
      );
    }
    return fetch(input, init);
  },
});
