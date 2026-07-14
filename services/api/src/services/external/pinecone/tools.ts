import { tool } from "ai";
import { z } from "zod";
import { KNOWLEDGE_RECORD_TYPES } from "./classificationRecord";
import { KnowledgeBaseService } from "./service";

const topKInput = z
  .number()
  .int()
  .min(1)
  .max(25)
  .default(8)
  .describe("How many matches to return.");

const searchClassificationsInput = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "The product, in classification-relevant terms — name, materials, function, e.g. 'wireless earbuds silicone tips bluetooth'.",
    ),
  scope: z
    .enum(["client", "organization"])
    .default("client")
    .describe(
      "client = only this importer's own products (their verified record). organization = every client of the brokerage — useful precedent, but not this importer's record.",
    ),
  topK: topKInput,
});

const searchKnowledgeInput = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "Natural-language query over the importer's document record, e.g. 'spec sheet LED mask' or 'packing list bluetooth speakers'.",
    ),
  topK: topKInput,
});

/**
 * Knowledge-base tools scoped to one organization (and, for precedent
 * search, one client). A factory so the tenant boundary is fixed by the
 * caller — never model-controlled.
 */
export function createKnowledgeBaseTools(
  organizationId: string,
  clientId?: string,
) {
  return {
    searchPriorClassifications: tool({
      description:
        "Search the brokerage's verified classification record — products already classified, each with its current HTS code, who verified it (broker or agent), and confidence. Broker-verified precedent for an identical or near-identical product is authoritative. Defaults to this importer's own products; pass scope=organization to widen to the whole brokerage.",
      inputSchema: searchClassificationsInput,
      execute: async (input) => {
        const matches = await KnowledgeBaseService.search({
          organizationId,
          query: input.query,
          topK: input.topK,
          filter: {
            type: { $eq: KNOWLEDGE_RECORD_TYPES.classification },
            ...(input.scope === "client" && clientId
              ? { clientId: { $eq: clientId } }
              : {}),
          },
        });

        return {
          source: "Azali verified classification record",
          query: input.query,
          scope: input.scope,
          matches: matches.map((match) => ({
            score: match.score,
            text: match.text,
            htsCode: match.metadata.htsCode ?? null,
            /** "broker" = human-verified; "agent" = high-trust AI verdict. */
            verifiedBy: match.metadata.source ?? null,
            confidence: match.metadata.confidence ?? null,
            verifiedAt: match.metadata.verifiedAt ?? null,
            /** True when the precedent is this importer's own product. */
            sameClient: clientId ? match.metadata.clientId === clientId : false,
          })),
        };
      },
    }),
    searchKnowledge: tool({
      description:
        "Search the importer's own document record — extracted invoices, packing lists, and spec sheets from prior shipments. Use it for product facts (composition, function, packaging). For prior classification verdicts, use searchPriorClassifications instead.",
      inputSchema: searchKnowledgeInput,
      execute: async (input) => ({
        source: "Azali knowledge base",
        query: input.query,
        matches: await KnowledgeBaseService.search({
          organizationId,
          query: input.query,
          topK: input.topK,
          filter: { type: { $eq: KNOWLEDGE_RECORD_TYPES.document } },
        }),
      }),
    }),
  };
}
