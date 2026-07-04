import { defineConfig } from "orval";

export default defineConfig({
  "azali-api": {
    input: {
      target: "http://localhost:3001/openapi.json",
    },
    output: {
      mode: "single",
      target: "./src/generated/api.ts",
      client: "react-query",
      override: {
        mutator: {
          path: "src/lib/axios.ts",
          name: "axios",
        },
      },
    },
  },
});
