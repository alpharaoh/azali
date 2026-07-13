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
    // Bun's fetch defaults to a 5-minute request timeout — long extended-
    // thinking generations exceed it. Deadlines are enforced upstream via
    // the AI SDK's timeout option instead. (Bun-specific fetch extension.)
    return fetch(input, { ...init, timeout: false } as RequestInit);
  },
});
