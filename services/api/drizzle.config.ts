import { defineConfig } from "drizzle-kit";

// drizzle-kit connects with node-postgres, which treats `sslrootcert=system`
// (PlanetScale's recommended param, understood by Bun's driver) as a literal
// file path and crashes. Drop it; `sslmode=verify-full` alone still fully
// verifies the server against Node's built-in CA store.
const url = new URL(
  // biome-ignore lint/style/noNonNullAssertion: required env var validated at startup
  process.env.DATABASE_URL!,
);
if (url.searchParams.get("sslrootcert") === "system") {
  url.searchParams.delete("sslrootcert");
}

export default defineConfig({
  out: "./src/db/migrations",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: url.toString(),
  },
});
