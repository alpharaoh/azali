import { z } from "zod";

const envSchema = z.object({
  VITE_API_SERVER_URL: z
    .string()
    .default(
      import.meta.env.PROD ? "https://api.azali.ai" : "http://localhost:3001",
    ),
});

const _env = envSchema.safeParse(import.meta.env);

if (!_env.success) {
  throw new Error(
    "❌ Invalid environment variables: " +
      JSON.stringify(_env.error.format(), null, 4),
  );
}

export const env = {
  API_SERVER_URL: _env.data.VITE_API_SERVER_URL,
};
