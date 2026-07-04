import { z } from "zod";

const envSchema = z.object({
  API_SERVER_URL: z.string().default("http://localhost:3001"),
});

const _env = envSchema.safeParse(import.meta.env);

if (!_env.success) {
  throw new Error(
    "❌ Invalid environment variables: " +
      JSON.stringify(_env.error.format(), null, 4),
  );
}

export const env = _env.data;
