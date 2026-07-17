import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  BETTER_AUTH_SECRET: z.string(),
  RESEND_API_KEY: z.string(),
  BETTER_AUTH_URL: z.string().optional(),
  TRUSTED_ORIGINS: z
    .string()
    .default("http://localhost:3000,https://app.azali.ai")
    .transform((origins) => origins.split(",").map((o) => o.trim())),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_S3_BUCKET: z.string(),
  PINECONE_API_KEY: z.string(),
  // Optional so the API boots without it; document extraction fails with a
  // clear error at the point of use instead.
  ANTHROPIC_API_KEY: z.string().optional(),
  // Optional — realtime broadcasts stay in-process without it; required
  // only when the API is horizontally scaled.
  // Optional — tracing is simply disabled when the keys are absent.
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASE_URL: z.string().optional(),
  UNIPILE_API_KEY: z.string().optional(),
  // Unipile host:port (no scheme), e.g. "api8.unipile.com:13851". Optional so
  // the API boots without it; email ingestion fails with a clear error at the
  // point of use instead.
  UNIPILE_DSN: z.string().optional(),
  // Shared secret Unipile sends back as a custom header on email webhooks.
  UNIPILE_WEBHOOK_SECRET: z.string().optional(),
  // Public base URL of this API (tunnel in dev) — used for Unipile callbacks.
  API_BASE_URL: z.string().optional(),
  // Optional — Datadog log shipping is simply disabled when the key is absent.
  DD_API_KEY: z.string().optional(),
  // Datadog intake site — this org lives on US5, not the default US1.
  DD_SITE: z.string().default("us5.datadoghq.com"),
  DD_SERVICE: z.string().default("azali-api"),
  // Environment tag on Datadog telemetry; falls back to NODE_ENV.
  DD_ENV: z.string().optional(),
  // Platform default for how long an email-sourced shipment collects
  // follow-up emails before classification starts. Organizations override
  // it per-org via settings (organization.emailIntakeWindowMinutes).
  EMAIL_INTAKE_WINDOW_MS: z.coerce.number().default(2 * 60 * 60 * 1000),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  throw new Error(
    "❌ Invalid environment variables: " +
      JSON.stringify(_env.error.format(), null, 4),
  );
}

export const env = _env.data;
