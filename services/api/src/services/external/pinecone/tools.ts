import { tool } from "ai";
import { z } from "zod";
import { KnowledgeBaseService } from "./service";

const searchKnowledgeInput = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "Natural-language query over the importer's document record, e.g. 'prior classifications of bluetooth speakers' or 'spec sheet LED mask'.",
    ),
  topK: z
    .number()
    .int()
    .min(1)
    .max(25)
    .default(8)
    .describe("How many matches to return."),
});

/**
 * Knowledge-base tools scoped to one organization. A factory so the tenant
 * boundary is fixed by the caller — never model-controlled.
 */
export function createKnowledgeBaseTools(organizationId: string) {
  return {
    searchKnowledge: tool({
      description:
        "Search the importer's own document record — extracted invoices, packing lists, spec sheets, and prior shipment documents. Use it to find product details and prior classification history for similar goods.",
      inputSchema: searchKnowledgeInput,
      execute: (input) =>
        KnowledgeBaseService.search({
          organizationId,
          query: input.query,
          topK: input.topK,
        }),
    }),
  };
}
