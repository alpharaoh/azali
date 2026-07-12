import { LangfuseClient } from "@langfuse/client";
import { env } from "@/env";

/** Null when the LANGFUSE_* keys are absent — prompt fetches then fall back. */
export const langfuse =
  env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY
    ? new LangfuseClient()
    : null;
