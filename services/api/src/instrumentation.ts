/**
 * Langfuse tracing over OpenTelemetry. Must be imported before any AI SDK
 * call sites — it is the first import in main.ts. No-ops (tracing disabled)
 * when the LANGFUSE_* keys are not configured.
 */

import { LangfuseSpanProcessor } from "@langfuse/otel";
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { registerTelemetry } from "ai";
import { env } from "@/env";

export const langfuseSpanProcessor =
  env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY
    ? new LangfuseSpanProcessor()
    : null;

if (langfuseSpanProcessor) {
  const sdk = new NodeSDK({ spanProcessors: [langfuseSpanProcessor] });
  sdk.start();
  registerTelemetry(new LangfuseVercelAiSdkIntegration());
}
