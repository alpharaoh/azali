import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  BETTER_AUTH_SECRET: z.string(),
  RESEND_API_KEY: z.string(),
  BETTER_AUTH_URL: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_S3_BUCKET: z.string(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  throw new Error(
    "❌ Invalid environment variables: " +
      JSON.stringify(_env.error.format(), null, 4),
  );
}

export const env = _env.data;
