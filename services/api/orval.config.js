import { defineConfig } from "orval";

export default defineConfig({
  "deck-engine": {
    input: {
      target: "http://localhost:3002/openapi/v1.json",
    },
    output: {
      mode: "single",
      target: "./src/generated/deck-engine.ts",
      client: "axios",
      override: {
        mutator: {
          path: "src/services/deck-engine/axios.ts",
          name: "deckEngineAxios",
        },
      },
    },
  },
});
