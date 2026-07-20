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

const searchScreeningsInput = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "The product in screening-relevant terms — name, materials, origin, use, e.g. 'frozen shrimp Vietnam SIMP' or 'wooden picture frame China'.",
    ),
  scope: z
    .enum(["client", "organization"])
    .default("client")
    .describe(
      "client = only this importer's own screening record. organization = every client of the brokerage.",
    ),
  topK: topKInput,
});

/** The shared document-facts tool — both agents get it. */
function documentKnowledgeTool(organizationId: string) {
  return tool({
    description:
      "Search the importer's own document record — extracted invoices, packing lists, and spec sheets from prior shipments. Use it for product facts (composition, function, packaging, intended use).",
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
  });
}

function screeningKnowledgeTools(organizationId: string, clientId?: string) {
  return {
    searchPriorScreenings: tool({
      description:
        "Search the brokerage's PGA screening record — lines already screened, each with its agency determinations (file / disclaim / not applicable) for a specific product and origin. Broker-approved precedent for the same product AND origin is strong; a different origin is context only, since screening is origin-sensitive. Defaults to this importer's own record; pass scope=organization to widen to the whole brokerage.",
      inputSchema: searchScreeningsInput,
      execute: async (input) => {
        const matches = await KnowledgeBaseService.search({
          organizationId,
          query: input.query,
          topK: input.topK,
          filter: {
            type: { $eq: KNOWLEDGE_RECORD_TYPES.pgaScreening },
            ...(input.scope === "client" && clientId
              ? { clientId: { $eq: clientId } }
              : {}),
          },
        });

        return {
          source: "Azali PGA screening record",
          query: input.query,
          scope: input.scope,
          matches: matches.map((match) => ({
            score: match.score,
            text: match.text,
            htsCode: match.metadata.htsCode ?? null,
            originCountry: match.metadata.originCountry ?? null,
            agencies: match.metadata.agencies ?? [],
            /** "broker" = human-approved; "agent" = autopilot screening. */
            verifiedBy: match.metadata.source ?? null,
            verifiedAt: match.metadata.verifiedAt ?? null,
            sameClient: clientId ? match.metadata.clientId === clientId : false,
          })),
        };
      },
    }),
    searchKnowledge: documentKnowledgeTool(organizationId),
  };
}

function classificationKnowledgeTools(
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
            // Broker verification is ground truth — records indexed before
            // that verdict may carry the agent's lower pre-approval score.
            confidence:
              match.metadata.source === "broker"
                ? 1
                : (match.metadata.confidence ?? null),
            verifiedAt: match.metadata.verifiedAt ?? null,
            /** True when the precedent is this importer's own product. */
            sameClient: clientId ? match.metadata.clientId === clientId : false,
          })),
        };
      },
    }),
    searchKnowledge: documentKnowledgeTool(organizationId),
  };
}

/**
 * Knowledge-base tools scoped to one organization (and, for precedent
 * search, one client). A factory so the tenant boundary is fixed by the
 * caller — never model-controlled. The purpose fixes which precedent record
 * type the agent can see: classification agents get classification verdicts,
 * the PGA agent gets prior screenings — never each other's.
 */
export function createKnowledgeBaseTools(
  organizationId: string,
  clientId: string | undefined,
  purpose: "classification",
): ReturnType<typeof classificationKnowledgeTools>;
export function createKnowledgeBaseTools(
  organizationId: string,
  clientId: string | undefined,
  purpose: "pga",
): ReturnType<typeof screeningKnowledgeTools>;
export function createKnowledgeBaseTools(
  organizationId: string,
  clientId: string | undefined,
  purpose: "classification" | "pga",
) {
  return purpose === "pga"
    ? screeningKnowledgeTools(organizationId, clientId)
    : classificationKnowledgeTools(organizationId, clientId);
}
